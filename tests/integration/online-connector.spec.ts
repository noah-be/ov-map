import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { OnlineConnector } from '../../server/online-connector'

const executable = resolve('tests/fixtures/fake-connector.mjs')
let connector: OnlineConnector | null = null

async function waitFor(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 3_000
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error('Timed out waiting for connector event')
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 10))
  }
}

afterEach(() => {
  connector?.disconnect()
  connector = null
  vi.unstubAllEnvs()
})

describe('OnlineConnector process integration', () => {
  it('spawns the executable and consumes newline-delimited snapshots', async () => {
    const onSnapshot = vi.fn<(snapshot: unknown, address: string) => void>()
    vi.stubEnv('OV_MAP_CONNECTOR_PATH', executable)
    connector = new OnlineConnector(onSnapshot)

    expect((await connector.connect('hifi://example.test', process.cwd())).state).toBe('connecting')
    await waitFor(() => connector?.status.state === 'complete')

    expect(connector.status).toMatchObject({
      state: 'complete',
      address: 'example.test',
      message: 'Live: 1 entities, 1 avatars',
    })
    expect(onSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'world.snapshot', connected: true }),
      'example.test',
    )
  })

  it('transitions to error for connector error events', async () => {
    vi.stubEnv('OV_MAP_CONNECTOR_PATH', executable)
    connector = new OnlineConnector(vi.fn<(snapshot: unknown, address: string) => void>())
    await connector.connect('connection-error', process.cwd())
    await waitFor(() => connector?.status.state === 'error')
    expect(connector.status.message).toBe('Domain rejected connection')
  })

  it('reports a missing executable', async () => {
    vi.stubEnv('OV_MAP_CONNECTOR_PATH', '/missing/ov-map-connector')
    connector = new OnlineConnector(vi.fn<(snapshot: unknown, address: string) => void>())
    await expect(connector.connect('example.test', '/missing/root')).rejects.toThrow(
      'Headless connector not found',
    )
  })

  it('returns to idle when disconnected', async () => {
    vi.stubEnv('OV_MAP_CONNECTOR_PATH', executable)
    connector = new OnlineConnector(vi.fn<(snapshot: unknown, address: string) => void>())
    await connector.connect('example.test', process.cwd())
    connector.disconnect()
    expect(connector.status).toEqual({
      state: 'idle',
      address: null,
      message: 'Ready to connect',
      startedAt: null,
    })
  })
})
