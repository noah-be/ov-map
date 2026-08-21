# syntax=docker/dockerfile:1.7

ARG OVERTE_COMMIT=9cd003d7f47149ec55b5432b799310ebd356efdc
ARG OVERTE_REPOSITORY=https://github.com/noah-be/overte.git

FROM ubuntu:22.04 AS connector-build

ARG DEBIAN_FRONTEND=noninteractive
ARG OVERTE_COMMIT
ARG OVERTE_REPOSITORY

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential ca-certificates curl git libasound2-dev libfontconfig1-dev \
    libgl1-mesa-dev libjack-dev libnspr4-dev libnss3-dev libpulse-dev \
    libqt5svg5-dev libqt5websockets5-dev libssl-dev libudev-dev libxcomposite-dev \
    libxcursor-dev libxi-dev libxmu-dev libxrandr-dev libxslt1-dev libxtst-dev \
    ninja-build nodejs npm pax-utils pkg-config python3 python3-pip qtbase5-dev \
    qttools5-dev zlib1g-dev \
    && python3 -m pip install --no-cache-dir 'cmake>=3.27,<4' 'conan>=2,<3' \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src
RUN git clone "${OVERTE_REPOSITORY}" overte \
    && git -C overte checkout "${OVERTE_COMMIT}"

COPY connector /src/connector
RUN cp -R /src/connector /src/overte/tools/ov-map-connector \
    && sed -i '/^[[:space:]]*ac-client$/a\        ov-map-connector' /src/overte/tools/CMakeLists.txt \
    && grep -q '^[[:space:]]*ov-map-connector$' /src/overte/tools/CMakeLists.txt

WORKDIR /src/overte
RUN conan profile detect --force \
    && conan remote add overte https://artifactory.overte.org/artifactory/api/conan/overte --force \
    && printf '%s\n' 'tools.system.package_manager:mode=install' 'tools.system.package_manager:sudo=False' >> /root/.conan2/global.conf \
    && conan install . \
      -s build_type=Release \
      -b missing \
      -pr:h=tools/conan-profiles/linux \
      -pr:b=tools/conan-profiles/linux \
      -of build \
      -c tools.cmake.cmaketoolchain:generator='Ninja Multi-Config'

RUN cmake --preset conan-default \
      -DOVERTE_BUILD_CLIENT=OFF \
      -DOVERTE_BUILD_SERVER=OFF \
      -DOVERTE_BUILD_TOOLS=ON \
      -DBUILD_TOOLS_INCLUDE=ov-map-connector \
    && cmake --build --preset conan-release --target ov-map-connector --parallel 4

RUN connector_path="$(find /src/overte/build -type f -name ov-map-connector -perm /111 | head -n 1)" \
    && test -n "${connector_path}" \
    && install -D "${connector_path}" /runtime/bin/ov-map-connector \
    && mkdir -p /runtime/lib \
    && lddtree -l "${connector_path}" \
      | awk '/^\/(src\/overte\/build|root\/\.conan2)\// { print }' \
      | sort -u \
      | xargs -r -I '{}' cp -L '{}' /runtime/lib/

FROM node:22-bookworm-slim AS web-build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM ubuntu:22.04 AS runtime

ARG DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl libfontconfig1 libgl1 libnspr4 libnss3 libopengl0 libpulse0 \
    libqt5core5a libqt5gui5 libqt5network5 libqt5websockets5 libqt5widgets5 \
    libssl3 libstdc++6 \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/ov-map
COPY --from=connector-build /runtime/bin /opt/ov-map/connector/bin
COPY --from=connector-build /runtime/lib /opt/ov-map/connector/lib
COPY --from=web-build /app/dist ./dist
COPY --from=web-build /app/dist-server ./dist-server
COPY --from=web-build /app/node_modules ./node_modules
COPY --from=web-build /app/package.json ./package.json
COPY sample-data ./sample-data

ENV NODE_ENV=production \
    OV_MAP_CONNECTOR_PATH=/opt/ov-map/connector/bin/ov-map-connector \
    LD_LIBRARY_PATH=/opt/ov-map/connector/lib \
    OV_MAP_PORT=8787 \
    OV_MAP_DOMAIN=overte_hub

EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl --fail --silent http://127.0.0.1:8787/api/health >/dev/null || exit 1

USER nobody
CMD ["node", "dist-server/server/index.js"]
