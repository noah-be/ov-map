export interface Vector3 {
  x: number
  y: number
  z: number
}

export interface MapEntity {
  id: string
  name: string
  type: string
  position: Vector3
  dimensions: Vector3
  rotation: { x: number; y: number; z: number; w: number } | null
  parentId: string | null
  visible: boolean
  color: { red: number; green: number; blue: number } | null
  modelUrl: string | null
  imageUrl: string | null
  description: string | null
}

export interface WorldBounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export interface WorldMapData {
  source: string
  loadedAt: string
  version: number | null
  entityCount: number
  bounds: WorldBounds
  types: Record<string, number>
  entities: MapEntity[]
}
