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
- Automatic source refresh
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

## Quality checks

```sh
npm run lint
npm run test:unit -- --run
npm run build
```

## Technology

- Vue 3, Pinia, and TypeScript
- Canvas-based map renderer
- Vite
- Node.js and Express
- Vitest
- ESLint, Oxlint, and Prettier

## License

[MIT](LICENSE)
