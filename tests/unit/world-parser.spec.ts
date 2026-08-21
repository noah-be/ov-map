import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'

import { parseLiveSnapshot, parseWorldBuffer } from '../../server/world-parser'

function parse(document: unknown) {
  return parseWorldBuffer(Buffer.from(JSON.stringify(document)), 'fixture.json')
}

describe('world parser', () => {
  it('normalizes all supported entity fields and scalar strings', () => {
    const result = parse({
      Version: 65,
      Entities: [{
        entityID: 'fallback-id',
        type: 'Shape',
        localPosition: { x: '2.5', y: null, z: -4 },
        dimensions: { x: 4, y: 5, z: 6 },
        rotation: { x: 0, y: 0.5, z: 0, w: 0.5 },
        parentID: 'parent',
        visible: 'false',
        color: { red: 12, green: 34, blue: 56 },
        modelURL: 'https://example.test/model.glb',
        imageURL: 'https://example.test/image.png',
        description: 'A shape',
      }],
    })

    expect(result.entities[0]).toMatchObject({
      id: 'fallback-id',
      name: 'Unnamed Shape',
      type: 'Shape',
      position: { x: 2.5, y: 0, z: -4 },
      dimensions: { x: 4, y: 5, z: 6 },
      parentId: 'parent',
      visible: false,
      color: { red: 12, green: 34, blue: 56 },
      modelUrl: 'https://example.test/model.glb',
      imageUrl: 'https://example.test/image.png',
      description: 'A shape',
    })
  })

  it('uses safe defaults and ignores non-object entity entries', () => {
    const result = parse({ Entities: [null, 'invalid', { type: '', dimensions: null }] })

    expect(result.entityCount).toBe(1)
    expect(result.version).toBeNull()
    expect(result.entities[0]).toMatchObject({
      id: 'entity-2',
      name: 'Unnamed Entity',
      type: 'Unknown',
      position: { x: 0, y: 0, z: 0 },
      dimensions: { x: 1, y: 1, z: 1 },
      visible: true,
    })
  })

  it('returns stable default bounds for an empty export', () => {
    expect(parse({ Entities: [] }).bounds).toEqual({ minX: -10, maxX: 10, minZ: -10, maxZ: 10 })
  })

  it('excludes huge environmental zones when calculating map bounds', () => {
    const result = parse({
      Entities: [
        { id: 'zone', type: 'Zone', position: { x: 50_000, z: 50_000 }, dimensions: { x: 1_000_000, z: 1_000_000 } },
        { id: 'model', type: 'Model', position: { x: 10, z: 20 }, dimensions: { x: 2, z: 4 } },
      ],
    })

    expect(result.bounds.maxX).toBeLessThan(100)
    expect(result.bounds.maxZ).toBeLessThan(100)
  })

  it('counts normalized types', () => {
    expect(parse({ Entities: [{ type: 'Model' }, { type: 'Model' }, { type: 'Text' }] }).types)
      .toEqual({ Model: 2, Text: 1 })
  })

  it('detects gzip by magic bytes regardless of filename', () => {
    const bytes = gzipSync(JSON.stringify({ Entities: [{ type: 'Model' }] }))
    expect(parseWorldBuffer(bytes, 'download').entityCount).toBe(1)
  })

  it.each([{}, [], null, { Entities: 'nope' }])('rejects invalid export %j', (document) => {
    expect(() => parse(document)).toThrow('Expected an Overte entity export')
  })

  it('normalizes connector timestamps and valid avatars', () => {
    const result = parseLiveSnapshot({
      timestamp: '2026-08-21T10:00:00.000Z',
      entities: [{ id: 'live', type: 'Model' }],
      avatars: [
        {
          id: 'avatar-1',
          displayName: 'Ada',
          position: { x: 1, y: 2, z: 3 },
          orientation: { x: 0, y: 0, z: 0, w: 1 },
        },
        { id: 'invalid' },
      ],
    }, 'overte_hub')

    expect(result.source).toBe('overte_hub')
    expect(result.loadedAt).toBe('2026-08-21T10:00:00.000Z')
    expect(result.avatars).toEqual([{
      id: 'avatar-1',
      displayName: 'Ada',
      position: { x: 1, y: 2, z: 3 },
      orientation: { x: 0, y: 0, z: 0, w: 1 },
    }])
  })

  it('rejects invalid connector snapshots', () => {
    expect(() => parseLiveSnapshot({ entities: null }, 'live')).toThrow('connector snapshot')
  })
})
