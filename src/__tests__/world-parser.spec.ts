import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'

import { parseWorldBuffer } from '../../server/world-parser'

const exportDocument = {
  Version: 65,
  Entities: [
    {
      id: 'one',
      name: 'Building',
      type: 'Model',
      position: { x: 10, y: 2, z: -4 },
      dimensions: { x: 8, y: 3, z: 6 },
    },
    {
      id: 'two',
      type: 'Zone',
      position: { x: -5, y: 0, z: 8 },
      dimensions: { x: 10, y: 10, z: 10 },
      visible: 'false',
    },
  ],
}

describe('parseWorldBuffer', () => {
  it('normalizes Overte entity exports and calculates map metadata', () => {
    const world = parseWorldBuffer(Buffer.from(JSON.stringify(exportDocument)), 'fixture.json')

    expect(world.version).toBe(65)
    expect(world.entityCount).toBe(2)
    expect(world.types).toEqual({ Model: 1, Zone: 1 })
    expect(world.entities[0]?.position).toEqual({ x: 10, y: 2, z: -4 })
    expect(world.entities[1]?.visible).toBe(false)
    expect(world.bounds.minX).toBeLessThanOrEqual(-10)
    expect(world.bounds.maxX).toBeGreaterThanOrEqual(14)
  })

  it('decompresses gzip exports', () => {
    const compressed = gzipSync(JSON.stringify(exportDocument))
    expect(parseWorldBuffer(compressed, 'models.json.gz').entityCount).toBe(2)
  })

  it('rejects unrelated JSON documents', () => {
    expect(() => parseWorldBuffer(Buffer.from('{}'), 'invalid.json')).toThrow(
      'Expected an Overte entity export',
    )
  })
})
