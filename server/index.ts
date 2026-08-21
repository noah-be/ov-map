import express from 'express'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import type { WorldMapData } from '../shared/world.js'
import { loadWorld } from './world-source.js'
import { OnlineConnector } from './online-connector.js'
import { parseLiveSnapshot } from './world-parser.js'

const root = process.cwd()
const app = express()
const port = Number(process.env.OV_MAP_PORT ?? process.env.PORT ?? 8787)
const source = process.env.OV_MAP_WORLD_SOURCE ?? resolve(root, 'sample-data/demo-world.json')
const defaultDomain = process.env.OV_MAP_DOMAIN ?? 'overte_hub'
const refreshSeconds = Math.max(Number(process.env.OV_MAP_REFRESH_SECONDS ?? 60), 5)

let world: WorldMapData | null = null
let loadError: string | null = null
const onlineConnector = new OnlineConnector((snapshot, address) => {
  world = parseLiveSnapshot(snapshot, address)
  loadError = null
})

async function refreshWorld(): Promise<void> {
  try {
    world = await loadWorld(source)
    loadError = null
    console.info(`Loaded ${world.entityCount} entities from ${world.source}`)
  } catch (error) {
    loadError = error instanceof Error ? error.message : String(error)
    console.error(`Could not load world: ${loadError}`)
  }
}

app.get('/api/health', (_request, response) => {
  response.status(loadError ? 503 : 200).json({ ok: !loadError, source, error: loadError })
})

app.get('/api/world', (_request, response) => {
  if (!world) {
    response.status(503).json({ error: loadError ?? 'World data has not loaded yet' })
    return
  }
  response.json(world)
})

app.get('/api/connection', (_request, response) => response.json(onlineConnector.status))

app.post('/api/connect', express.json({ limit: '8kb' }), async (request, response) => {
  try {
    const address = typeof request.body?.address === 'string' ? request.body.address : ''
    response.status(202).json(await onlineConnector.connect(address, root))
  } catch (error) {
    response.status(400).json({ error: error instanceof Error ? error.message : String(error) })
  }
})

const clientDirectory = resolve(root, 'dist')
if (existsSync(clientDirectory)) {
  app.use(express.static(clientDirectory))
  app.get('/{*path}', (_request, response) =>
    response.sendFile(resolve(clientDirectory, 'index.html')),
  )
}

await refreshWorld()
try {
  await onlineConnector.connect(defaultDomain, root)
} catch (error) {
  console.error(`Could not connect to ${defaultDomain}: ${error instanceof Error ? error.message : String(error)}`)
}
setInterval(() => {
  if (onlineConnector.status.state === 'idle') void refreshWorld()
}, refreshSeconds * 1000).unref()

app.listen(port, () => {
  console.info(`ov-map listening on http://localhost:${port}`)
})
