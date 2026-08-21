import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useWorldStore } from '../../src/stores/world'
import { connection, entity, world } from '../fixtures/world'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

describe('world store', () => {
  beforeEach(() => setActivePinia(createPinia()))
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('loads world data and clears a previous error', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(world())))
    const store = useWorldStore()
    store.error = 'old error'

    await store.load()

    expect(store.world?.entityCount).toBe(1)
    expect(store.error).toBeNull()
    expect(store.loading).toBe(false)
  })

  it('uses API errors and falls back to an HTTP status message', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ error: 'Not ready' }, 503))
      .mockResolvedValueOnce(new Response('invalid', { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)
    const store = useWorldStore()

    await store.load()
    expect(store.error).toBe('Not ready')
    await store.load()
    expect(store.error).toBe('World API returned HTTP 500')
  })

  it('filters by type, unnamed state, name, and type search', () => {
    const store = useWorldStore()
    store.world = world({ entities: [
      entity({ id: 'named', name: 'Welcome Plaza', type: 'Model' }),
      entity({ id: 'unnamed', name: 'Unnamed Shape', type: 'Shape' }),
      entity({ id: 'text', name: 'Information', type: 'Text' }),
    ] })

    store.search = 'plaza'
    expect(store.visibleEntities.map((item) => item.id)).toEqual(['named'])
    store.search = 'text'
    expect(store.visibleEntities.map((item) => item.id)).toEqual(['text'])
    store.search = ''
    store.hideUnnamed = true
    store.toggleType('Text')
    expect(store.visibleEntities.map((item) => item.id)).toEqual(['named'])
    store.showAll()
    expect(store.visibleEntities).toHaveLength(3)
  })

  it('maintains the selected entity and clears it', () => {
    const store = useWorldStore()
    const selected = entity({ id: 'selected' })
    store.world = world({ entities: [selected] })
    store.select(selected)
    expect(store.selectedEntity?.id).toBe('selected')
    store.select(null)
    expect(store.selectedEntity).toBeNull()
  })

  it('initializes world and connection status exactly once', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(world()))
      .mockResolvedValueOnce(jsonResponse(connection({ state: 'complete' })))
    vi.stubGlobal('fetch', fetchMock)

    await useWorldStore().initialize()
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/world', '/api/connection'])
  })

  it('connects, polls until complete, and then loads the live world', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(connection({ state: 'connecting', address: 'overte_hub' }), 202))
      .mockResolvedValueOnce(jsonResponse(connection({ state: 'complete', address: 'overte_hub' })))
      .mockResolvedValueOnce(jsonResponse(world({ source: 'overte_hub' })))
    vi.stubGlobal('fetch', fetchMock)
    const store = useWorldStore()

    const result = store.connect('overte_hub')
    await vi.advanceTimersByTimeAsync(1_000)
    await result

    expect(store.connection.state).toBe('complete')
    expect(store.world?.source).toBe('overte_hub')
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: 'POST' })
  })

  it('surfaces rejected connection requests and connector errors', async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ error: 'Invalid address' }, 400))
      .mockResolvedValueOnce(jsonResponse(connection({ state: 'connecting' }), 202))
      .mockResolvedValueOnce(jsonResponse(connection({ state: 'error', message: 'Rejected' })))
    vi.stubGlobal('fetch', fetchMock)
    const store = useWorldStore()

    await store.connect('bad')
    expect(store.error).toBe('Invalid address')

    vi.useFakeTimers()
    const result = store.connect('valid')
    await vi.advanceTimersByTimeAsync(1_000)
    await result
    expect(store.error).toBe('Rejected')
  })
})
