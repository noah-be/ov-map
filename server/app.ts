import express, { type Express } from 'express'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import type { ConnectionStatus, WorldMapData } from '../shared/world.js'
import { OnlineConnector } from './online-connector.js'
import { parseLiveSnapshot } from './world-parser.js'
import { loadWorld } from './world-source.js'

export interface Connector {
  readonly status: ConnectionStatus
  connect(input: string, root: string): Promise<ConnectionStatus>
}

export interface AppOptions {
  root: string
  source: string
  defaultDomain?: string | null
  clientDirectory?: string | null
  connector?: Connector
}

export interface OvMapApp {
  app: Express
  initialize(): Promise<void>
  refreshWorld(): Promise<void>
}

export function createOvMapApp(options: AppOptions): OvMapApp {
  const app = express()
  let world: WorldMapData | null = null
  let loadError: string | null = null
  const connector = options.connector ?? new OnlineConnector((snapshot, address) => {
    world = parseLiveSnapshot(snapshot, address)
    loadError = null
  })

  async function refreshWorld(): Promise<void> {
    try {
      world = await loadWorld(options.source)
      loadError = null
      console.info(`Loaded ${world.entityCount} entities from ${world.source}`)
    } catch (error) {
      loadError = error instanceof Error ? error.message : String(error)
      console.error(`Could not load world: ${loadError}`)
    }
  }

  app.get('/api/health', (_request, response) => {
    response.status(loadError ? 503 : 200).json({
      ok: !loadError,
      source: options.source,
      error: loadError,
    })
  })

  app.get('/api/world', (_request, response) => {
    if (!world) {
      response.status(503).json({ error: loadError ?? 'World data has not loaded yet' })
      return
    }
    response.json(world)
  })

  app.get('/api/connection', (_request, response) => response.json(connector.status))

  app.post('/api/connect', express.json({ limit: '8kb' }), async (request, response) => {
    try {
      const address = typeof request.body?.address === 'string' ? request.body.address : ''
      response.status(202).json(await connector.connect(address, options.root))
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : String(error) })
    }
  })

  if (options.clientDirectory && existsSync(options.clientDirectory)) {
    app.use(express.static(options.clientDirectory))
    app.get('/{*path}', (_request, response) =>
      response.sendFile(resolve(options.clientDirectory!, 'index.html')),
    )
  }

  async function initialize(): Promise<void> {
    await refreshWorld()
    if (!options.defaultDomain) return
    try {
      await connector.connect(options.defaultDomain, options.root)
    } catch (error) {
      console.error(
        `Could not connect to ${options.defaultDomain}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  return { app, initialize, refreshWorld }
}
