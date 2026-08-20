import { gunzipSync } from 'node:zlib'

import type { MapEntity, Vector3, WorldBounds, WorldMapData } from '../shared/world.js'

const DEFAULT_DIMENSIONS: Vector3 = { x: 1, y: 1, z: 1 }
const EMPTY_BOUNDS: WorldBounds = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 }

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function finiteNumber(value: unknown, fallback = 0): number {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : fallback
}

function vector(value: unknown, fallback: Vector3): Vector3 {
  if (!isRecord(value)) return { ...fallback }
  return {
    x: finiteNumber(value.x, fallback.x),
    y: finiteNumber(value.y, fallback.y),
    z: finiteNumber(value.z, fallback.z),
  }
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value.toLowerCase() !== 'false'
  return fallback
}

function normalizeEntity(raw: unknown, index: number): MapEntity | null {
  if (!isRecord(raw)) return null
  const position = vector(raw.position ?? raw.localPosition, { x: 0, y: 0, z: 0 })
  const dimensions = vector(raw.dimensions, DEFAULT_DIMENSIONS)
  const rawRotation = isRecord(raw.rotation) ? raw.rotation : null
  const rawColor = isRecord(raw.color) ? raw.color : null

  return {
    id: stringValue(raw.id) ?? stringValue(raw.entityID) ?? `entity-${index}`,
    name: stringValue(raw.name) ?? `Unnamed ${String(raw.type ?? 'Entity')}`,
    type: stringValue(raw.type) ?? 'Unknown',
    position,
    dimensions,
    rotation: rawRotation
      ? {
          x: finiteNumber(rawRotation.x),
          y: finiteNumber(rawRotation.y),
          z: finiteNumber(rawRotation.z),
          w: finiteNumber(rawRotation.w, 1),
        }
      : null,
    parentId: stringValue(raw.parentID),
    visible: booleanValue(raw.visible, true),
    color: rawColor
      ? {
          red: finiteNumber(rawColor.red, 255),
          green: finiteNumber(rawColor.green, 255),
          blue: finiteNumber(rawColor.blue, 255),
        }
      : null,
    modelUrl: stringValue(raw.modelURL),
    imageUrl: stringValue(raw.imageURL),
    description: stringValue(raw.description),
  }
}

function calculateBounds(entities: MapEntity[]): WorldBounds {
  if (entities.length === 0) return EMPTY_BOUNDS

  const bounds = entities.reduce<WorldBounds>(
    (result, entity) => {
      const halfX = Math.max(entity.dimensions.x / 2, 0.25)
      const halfZ = Math.max(entity.dimensions.z / 2, 0.25)
      return {
        minX: Math.min(result.minX, entity.position.x - halfX),
        maxX: Math.max(result.maxX, entity.position.x + halfX),
        minZ: Math.min(result.minZ, entity.position.z - halfZ),
        maxZ: Math.max(result.maxZ, entity.position.z + halfZ),
      }
    },
    { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity },
  )

  const padding = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ, 10) * 0.05
  return {
    minX: bounds.minX - padding,
    maxX: bounds.maxX + padding,
    minZ: bounds.minZ - padding,
    maxZ: bounds.maxZ + padding,
  }
}

export function parseWorldBuffer(buffer: Buffer, source: string): WorldMapData {
  const bytes = buffer[0] === 0x1f && buffer[1] === 0x8b ? gunzipSync(buffer) : buffer
  const document: unknown = JSON.parse(bytes.toString('utf8'))
  if (!isRecord(document) || !Array.isArray(document.Entities)) {
    throw new Error('Expected an Overte entity export with an Entities array')
  }

  const entities = document.Entities.map(normalizeEntity).filter(
    (entity): entity is MapEntity => entity !== null,
  )
  const types = entities.reduce<Record<string, number>>((counts, entity) => {
    counts[entity.type] = (counts[entity.type] ?? 0) + 1
    return counts
  }, {})

  return {
    source,
    loadedAt: new Date().toISOString(),
    version: typeof document.Version === 'number' ? document.Version : null,
    entityCount: entities.length,
    bounds: calculateBounds(entities),
    types,
    entities,
  }
}
