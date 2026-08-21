import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'

import { createOvMapApp, type Connector } from '../../server/app'
import type { ConnectionStatus } from '../../shared/world'

function fakeConnector(): Connector & {
  connect: ReturnType<typeof vi.fn<(address: string, root: string) => Promise<ConnectionStatus>>>
} {
  const status: ConnectionStatus = {
    state: 'idle',
    address: null,
    message: 'Ready to connect',
    startedAt: null,
  }
  return {
    status,
    connect: vi.fn<(address: string, root: string) => Promise<ConnectionStatus>>(async (address) => ({
      state: 'connecting' as const,
      address,
      message: `Connecting to ${address}`,
      startedAt: '2026-08-21T12:00:00.000Z',
    })),
  }
}

async function fixtureSource(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'ov-map-app-'))
  const source = join(directory, 'world.json')
  await writeFile(source, JSON.stringify({
    Version: 65,
    Entities: [{ id: 'one', name: 'Plaza', type: 'Model' }],
  }))
  return source
}

describe('ov-map HTTP app', () => {
  it('reports unavailable world data before initialization', async () => {
    const source = await fixtureSource()
    const runtime = createOvMapApp({ root: process.cwd(), source, connector: fakeConnector() })

    const response = await request(runtime.app).get('/api/world')
    expect(response.status).toBe(503)
    expect(response.body.error).toContain('not loaded')
  })

  it('serves health, parsed world data, and idle connection state', async () => {
    const source = await fixtureSource()
    const runtime = createOvMapApp({ root: process.cwd(), source, connector: fakeConnector() })
    await runtime.initialize()

    const [health, world, connection] = await Promise.all([
      request(runtime.app).get('/api/health'),
      request(runtime.app).get('/api/world'),
      request(runtime.app).get('/api/connection'),
    ])

    expect(health.status).toBe(200)
    expect(health.body).toMatchObject({ ok: true, source, error: null })
    expect(world.body).toMatchObject({ version: 65, entityCount: 1 })
    expect(connection.body.state).toBe('idle')
  })

  it('returns a degraded health response when the source cannot load', async () => {
    const runtime = createOvMapApp({
      root: process.cwd(),
      source: resolve('does-not-exist.json'),
      connector: fakeConnector(),
    })
    await runtime.initialize()

    expect((await request(runtime.app).get('/api/health')).status).toBe(503)
    expect((await request(runtime.app).get('/api/world')).status).toBe(503)
  })

  it('starts the configured default domain during initialization', async () => {
    const connector = fakeConnector()
    const runtime = createOvMapApp({
      root: '/app',
      source: await fixtureSource(),
      defaultDomain: 'overte_hub',
      connector,
    })
    await runtime.initialize()

    expect(connector.connect).toHaveBeenCalledWith('overte_hub', '/app')
  })

  it('accepts a manual connection and validates malformed requests', async () => {
    const connector = fakeConnector()
    const runtime = createOvMapApp({ root: '/app', source: await fixtureSource(), connector })

    const accepted = await request(runtime.app).post('/api/connect').send({ address: 'example.com' })
    expect(accepted.status).toBe(202)
    expect(accepted.body).toMatchObject({ state: 'connecting', address: 'example.com' })

    connector.connect.mockRejectedValueOnce(new Error('Invalid Overte address'))
    const rejected = await request(runtime.app).post('/api/connect').send({ address: '<bad>' })
    expect(rejected.status).toBe(400)
    expect(rejected.body.error).toBe('Invalid Overte address')
  })

  it('serves built assets and falls back to index.html for client routes', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'ov-map-client-'))
    await writeFile(join(directory, 'index.html'), '<h1>ov-map test</h1>')
    await writeFile(join(directory, 'asset.txt'), 'asset')
    const runtime = createOvMapApp({
      root: process.cwd(),
      source: await fixtureSource(),
      clientDirectory: directory,
      connector: fakeConnector(),
    })

    expect((await request(runtime.app).get('/asset.txt')).text).toBe('asset')
    expect((await request(runtime.app).get('/some/client/route')).text).toContain('ov-map test')
  })
})
