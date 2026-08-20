import express from 'express'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import type { WorldMapData } from '../shared/world.js'
import { loadWorld } from './world-source.js'

const root = process.cwd()
const app = express()
const port = Number(process.env.OV_MAP_PORT ?? 8787)
const source = process.env.OV_MAP_WORLD_SOURCE ?? resolve(root, 'sample-data/demo-world.json')
const refreshSeconds = Math.max(Number(process.env.OV_MAP_REFRESH_SECONDS ?? 60), 5)

let world: WorldMapData | null = null
let loadError: string | null = null

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

const clientDirectory = resolve(root, 'dist')
if (existsSync(clientDirectory)) {
  app.use(express.static(clientDirectory))
  app.get('/{*path}', (_request, response) =>
    response.sendFile(resolve(clientDirectory, 'index.html')),
  )
}

await refreshWorld()
setInterval(refreshWorld, refreshSeconds * 1000).unref()

app.listen(port, () => {
  console.info(`ov-map listening on http://localhost:${port}`)
})
