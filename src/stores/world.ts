import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import type { ConnectionStatus, MapEntity, WorldMapData } from '../../shared/world'

export const useWorldStore = defineStore('world', () => {
  const world = ref<WorldMapData | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const selectedId = ref<string | null>(null)
  const hiddenTypes = ref(new Set<string>())
  const search = ref('')
  const connection = ref<ConnectionStatus>({
    state: 'idle',
    address: null,
    message: 'Ready to connect',
    startedAt: null,
  })

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

  async function initialize(): Promise<void> {
    await load()
    await refreshConnection()
  }

  async function refreshConnection(): Promise<void> {
    try {
      const response = await fetch('/api/connection')
      connection.value = (await response.json()) as ConnectionStatus
    } catch {
      // The world endpoint already reports actionable server errors.
    }
  }

  async function connect(address: string): Promise<void> {
    error.value = null
    const response = await fetch('/api/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address }),
    })
    const body = (await response.json()) as ConnectionStatus & { error?: string }
    if (!response.ok) {
      error.value = body.error ?? `Connection API returned HTTP ${response.status}`
      return
    }
    connection.value = body
    const startedAt = Date.now()
    while (Date.now() - startedAt < 45_000) {
      await new Promise((resolve) => window.setTimeout(resolve, 1000))
      const statusResponse = await fetch('/api/connection')
      connection.value = (await statusResponse.json()) as ConnectionStatus
      if (connection.value.state === 'complete') {
        await load()
        return
      }
      if (connection.value.state === 'error') {
        error.value = connection.value.message
        return
      }
    }
    error.value = 'The world scan timed out after 45 seconds'
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
    connection,
    visibleEntities,
    load,
    initialize,
    connect,
    toggleType,
    select,
  }
})
