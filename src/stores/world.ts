import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import type { MapEntity, WorldMapData } from '../../shared/world'

export const useWorldStore = defineStore('world', () => {
  const world = ref<WorldMapData | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const selectedId = ref<string | null>(null)
  const hiddenTypes = ref(new Set<string>())
  const search = ref('')

  const selectedEntity = computed(
    () => world.value?.entities.find((entity) => entity.id === selectedId.value) ?? null,
  )
  const visibleEntities = computed(() => {
    const query = search.value.trim().toLowerCase()
    return (
      world.value?.entities.filter(
        (entity) =>
          !hiddenTypes.value.has(entity.type) &&
          (!query ||
            entity.name.toLowerCase().includes(query) ||
            entity.type.toLowerCase().includes(query)),
      ) ?? []
    )
  })

  async function load(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const response = await fetch('/api/world')
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? `World API returned HTTP ${response.status}`)
      }
      world.value = (await response.json()) as WorldMapData
    } catch (reason) {
      error.value = reason instanceof Error ? reason.message : String(reason)
    } finally {
      loading.value = false
    }
  }

  function toggleType(type: string): void {
    const next = new Set(hiddenTypes.value)
    if (next.has(type)) next.delete(type)
    else next.add(type)
    hiddenTypes.value = next
  }

  function select(entity: MapEntity | null): void {
    selectedId.value = entity?.id ?? null
  }

  return {
    world,
    loading,
    error,
    selectedId,
    selectedEntity,
    hiddenTypes,
    search,
    visibleEntities,
    load,
    toggleType,
    select,
  }
})
