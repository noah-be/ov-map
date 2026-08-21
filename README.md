# ov-map

An unofficial community project for displaying Overte worlds as interactive web maps, inspired by tools such as Dynmap.

> [!IMPORTANT]
> ov-map is an independent hobby project. It is not an official Overte project and is not affiliated with or endorsed by the Overte organization.

The app can read an Overte entity export or use its native headless connector to
stream a public world into the map. The connector speaks the normal Overte
domain protocol directly; it does not automate Interface and needs no display.

## Features

- Local and remote Overte entity exports
- Automatic gzip decompression
- Pan and cursor-centered zoom
- Entity type layers and name search
- Entity position, size, description, and model details
- Manual world refresh without page reloads
- Bundled demo world for development
- Anonymous live connection to public domains
- Live player positions from the Avatar Mixer

## Development

Requirements:

- Node.js 22.18 or newer
- npm 10 or newer

Install dependencies and start the frontend and API together:

```sh
npm install
npm run dev
```

Open <http://localhost:5173>. Without additional configuration, ov-map loads the bundled demo world.

## Use an Overte world export

Set `OV_MAP_WORLD_SOURCE` to a local file:

```sh
OV_MAP_WORLD_SOURCE=/var/lib/overte/default/entities/models.json.gz npm run dev
```

Or to an HTTP(S) URL exposed by an Overte entity server:

```sh
OV_MAP_WORLD_SOURCE=https://world.example/models.json.gz npm run dev
```

Available server settings:

| Variable | Default | Description |
| --- | --- | --- |
| `OV_MAP_WORLD_SOURCE` | `sample-data/demo-world.json` | Local path or HTTP(S) URL to an entity export |
| `OV_MAP_REFRESH_SECONDS` | `60` | Reload interval, with a minimum of five seconds |
| `OV_MAP_PORT` | `8787` | API and production web server port |
| `OV_MAP_CONNECTOR_PATH` | searched automatically | Path to the native headless connector |
| `OV_MAP_DOMAIN` | `overte_hub` | Public domain connected automatically at startup |

Remote downloads time out after 15 seconds and are limited to 64 MiB. The source is configured server-side; it cannot be changed through the public API.

## Connect to a public world

Build the native program as described in [connector/README.md](connector/README.md),
then start ov-map with its path:

```sh
OV_MAP_CONNECTOR_PATH=/path/to/ov-map-connector npm run dev
```

Enter `overte_hub` in the web UI. The Node service keeps the connector running
and updates entities and avatar positions once per second. Access is anonymous;
domains that require authentication can reject the connection.

## Production

```sh
npm run build
OV_MAP_WORLD_SOURCE=/path/to/models.json.gz npm start
```

The production server provides the API and the built Vue application at <http://localhost:8787>.

## Docker Compose

The CI pipeline publishes a self-contained Linux image containing the web app
and native headless Overte connector to GitHub Container Registry.

```yaml
services:
  ov-map:
    image: ghcr.io/noah-be/ov-map:main
    restart: unless-stopped
    init: true
    ports:
      - "8787:8787"
    environment:
      OV_MAP_DOMAIN: ${OV_MAP_DOMAIN:-overte_hub}
```

Start it with:

```sh
docker compose up -d
```

Open <http://localhost:8787>. Change `OV_MAP_DOMAIN` to another public place or
domain, for example with `OV_MAP_DOMAIN=my-place docker compose up -d`. The
image currently targets `linux/amd64`.

Images are built for pushes to `main`, version tags, pull requests, and manual
workflow runs. Published tags include `main`, `latest`, `sha-…`, and release
tags such as `v0.1.0`.

## Quality checks

```sh
npm run lint
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:coverage
npm run build
```

The E2E suite uses Playwright with Chromium and a touch-sized Firefox viewport.
Install the browsers once with `npx playwright install chromium firefox`.

## Technology

- Vue 3, Pinia, and TypeScript
- Canvas-based map renderer
- Vite
- Node.js and Express
- Vitest
- ESLint, Oxlint, and Prettier

## License

[MIT](LICENSE)
