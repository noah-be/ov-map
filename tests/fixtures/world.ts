import type { ConnectionStatus, MapEntity, WorldMapData } from '../../shared/world'

export function entity(overrides: Partial<MapEntity> = {}): MapEntity {
  return {
    id: 'entity-1',
    name: 'Welcome Plaza',
    type: 'Model',
    position: { x: 10, y: 2, z: -4 },
    dimensions: { x: 8, y: 3, z: 6 },
    rotation: null,
    parentId: null,
    visible: true,
    color: null,
    modelUrl: null,
    imageUrl: null,
    description: null,
    ...overrides,
  }
}

export function world(overrides: Partial<WorldMapData> = {}): WorldMapData {
  const entities = overrides.entities ?? [entity()]
  return {
    source: 'fixture.json',
    loadedAt: '2026-08-21T12:00:00.000Z',
    version: 65,
    entityCount: entities.length,
    bounds: { minX: 5, maxX: 15, minZ: -10, maxZ: 2 },
    types: entities.reduce<Record<string, number>>((types, item) => {
      types[item.type] = (types[item.type] ?? 0) + 1
      return types
    }, {}),
    entities,
    avatars: [],
    ...overrides,
  }
}

export function connection(overrides: Partial<ConnectionStatus> = {}): ConnectionStatus {
  return {
    state: 'idle',
    address: null,
    message: 'Ready to connect',
    startedAt: null,
    ...overrides,
  }
}
