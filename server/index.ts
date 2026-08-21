import { resolve } from 'node:path'

import { createOvMapApp } from './app.js'

const root = process.cwd()
const port = Number(process.env.OV_MAP_PORT ?? process.env.PORT ?? 8787)
const source = process.env.OV_MAP_WORLD_SOURCE ?? resolve(root, 'sample-data/demo-world.json')
const defaultDomain = process.env.OV_MAP_DOMAIN ?? 'overte_hub'
const clientDirectory = resolve(root, 'dist')
const { app, initialize } = createOvMapApp({ root, source, defaultDomain, clientDirectory })

await initialize()
app.listen(port, () => {
  console.info(`ov-map listening on http://localhost:${port}`)
})
