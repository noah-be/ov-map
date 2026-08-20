# ov-map

An unofficial community project for displaying Overte worlds as interactive web maps, inspired by tools such as Dynmap.

> [!IMPORTANT]
> ov-map is an independent hobby project. It is not an official Overte project and is not affiliated with or endorsed by the Overte organization.

The project is at an early stage. Its intended direction includes world-map rendering, location discovery, and useful live information for visitors and domain operators.

## Development

Requirements:

- Node.js 22.18 or newer
- npm 10 or newer

Install dependencies and start the development server:

```sh
npm install
npm run dev
```

Quality checks:

```sh
npm run build
npm run lint
npm run test:unit -- --run
```

## Technology

- Vue 3 and TypeScript
- Vite
- Vue Router
- Pinia
- Vitest
- ESLint, Oxlint, and Prettier

## License

[MIT](LICENSE)
