# Headless Overte connector

This native `QCoreApplication` connects to an Overte domain as an anonymous
Agent. It requests the Entity Server and Avatar Mixer, decodes their normal
network packets, and writes newline-delimited JSON snapshots to stdout. It does
not start Interface, a display plugin, X11, or a virtual framebuffer.

The first live test was made against Overte commit
`9cd003d7f47149ec55b5432b799310ebd356efdc` and the public place
`overte_hub`. It returned 749 entities and connected to the Avatar Mixer.

## Build inside an Overte checkout

Copy this directory into the Overte source tree and apply the tool-list patch:

```sh
cp -R connector /path/to/overte/tools/ov-map-connector
git -C /path/to/overte apply /path/to/ov-map/connector/overte-tools.patch
```

Then configure Overte with only this tool enabled:

```sh
cmake -S /path/to/overte -B /path/to/build \
  -DOVERTE_BUILD_CLIENT=OFF \
  -DOVERTE_BUILD_SERVER=OFF \
  -DOVERTE_BUILD_TOOLS=ON \
  -DBUILD_TOOLS_INCLUDE=ov-map-connector
cmake --build /path/to/build --config Release --target ov-map-connector
```

Overte's normal platform prerequisites and Conan setup are still required.

## Run directly

```sh
ov-map-connector --domain overte_hub
```

Options:

- `--domain`: place name, hostname, or domain address
- `--output`: append NDJSON to a file instead of stdout
- `--radius`: entity query radius in metres (default: `32768`)

Each `world.snapshot` event contains `entities`, `avatars`, a UTC timestamp,
and the connection state. Avatar entries include session UUID, display name,
world position, and world orientation.
