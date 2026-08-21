import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { loadWorld } from '../../server/world-source'

afterEach(() => vi.unstubAllGlobals())

describe('loadWorld', () => {
  it('loads a local export and resolves its absolute source path', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'ov-map-source-'))
    const filename = join(directory, 'world.json')
    await writeFile(filename, JSON.stringify({ Version: 65, Entities: [] }))

    const result = await loadWorld(filename)
    expect(result.source).toBe(filename)
    expect(result.entityCount).toBe(0)
  })

  it('loads an HTTP export', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(
      JSON.stringify({ Entities: [{ type: 'Model' }] }),
      { status: 200, headers: { 'content-length': '41' } },
    )))

    const result = await loadWorld('https://example.test/world.json')
    expect(result.entityCount).toBe(1)
    expect(fetch).toHaveBeenCalledOnce()
  })

  it('reports non-successful HTTP responses', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response('no', { status: 404 })))
    await expect(loadWorld('https://example.test/missing')).rejects.toThrow('HTTP 404')
  })

  it('rejects an oversized declared response without reading its body', async () => {
    const response = new Response('not read', {
      headers: { 'content-length': String(65 * 1024 * 1024) },
    })
    const arrayBuffer = vi.spyOn(response, 'arrayBuffer')
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(response))

    await expect(loadWorld('https://example.test/huge')).rejects.toThrow('64 MiB')
    expect(arrayBuffer).not.toHaveBeenCalled()
  })

  it('rejects an oversized body without a content-length header', async () => {
    const body = new Uint8Array(64 * 1024 * 1024 + 1)
    vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockResolvedValue(new Response(body)))

    await expect(loadWorld('https://example.test/huge')).rejects.toThrow('64 MiB')
  })
})
