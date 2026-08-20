<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

import type { MapEntity, WorldBounds } from '../../shared/world'

const props = defineProps<{
  entities: MapEntity[]
  bounds: WorldBounds
  selectedId: string | null
}>()
const emit = defineEmits<{ select: [entity: MapEntity | null] }>()

const canvas = ref<HTMLCanvasElement | null>(null)
const viewport = reactive({ centerX: 0, centerZ: 0, scale: 5 })
let resizeObserver: ResizeObserver | null = null
let drag: { x: number; y: number; centerX: number; centerZ: number } | null = null
let moved = false

const TYPE_COLORS: Record<string, string> = {
  Model: '#7fc8ff',
  Shape: '#efb556',
  Zone: '#5fc792',
  Text: '#d69cff',
  Web: '#ff7f88',
  Image: '#ff9ecb',
  Light: '#fff18a',
  PolyVox: '#a7b66b',
  Material: '#aaa4ff',
}

function colorFor(entity: MapEntity): string {
  if (entity.color) {
    return `rgb(${entity.color.red} ${entity.color.green} ${entity.color.blue})`
  }
  return TYPE_COLORS[entity.type] ?? '#96a8b5'
}

function fitWorld(): void {
  const element = canvas.value
  if (!element) return
  viewport.centerX = (props.bounds.minX + props.bounds.maxX) / 2
  viewport.centerZ = (props.bounds.minZ + props.bounds.maxZ) / 2
  const width = Math.max(props.bounds.maxX - props.bounds.minX, 1)
  const height = Math.max(props.bounds.maxZ - props.bounds.minZ, 1)
  viewport.scale = Math.max(
    0.05,
    Math.min(element.clientWidth / width, element.clientHeight / height) * 0.86,
  )
  draw()
}

function worldToScreen(x: number, z: number): { x: number; y: number } {
  const element = canvas.value
  if (!element) return { x: 0, y: 0 }
  return {
    x: element.clientWidth / 2 + (x - viewport.centerX) * viewport.scale,
    y: element.clientHeight / 2 + (z - viewport.centerZ) * viewport.scale,
  }
}

function drawGrid(context: CanvasRenderingContext2D, width: number, height: number): void {
  const targetWorldSpacing = 90 / viewport.scale
  const exponent = 10 ** Math.floor(Math.log10(targetWorldSpacing))
  const normalized = targetWorldSpacing / exponent
  const spacing = (normalized < 2 ? 2 : normalized < 5 ? 5 : 10) * exponent
  const topLeftX = viewport.centerX - width / 2 / viewport.scale
  const topLeftZ = viewport.centerZ - height / 2 / viewport.scale
  const startX = Math.floor(topLeftX / spacing) * spacing
  const startZ = Math.floor(topLeftZ / spacing) * spacing

  context.strokeStyle = 'rgba(150, 190, 205, 0.11)'
  context.fillStyle = 'rgba(180, 205, 215, 0.45)'
  context.lineWidth = 1
  context.font = '11px system-ui'

  for (let x = startX; x < topLeftX + width / viewport.scale; x += spacing) {
    const point = worldToScreen(x, 0)
    context.beginPath()
    context.moveTo(Math.round(point.x) + 0.5, 0)
    context.lineTo(Math.round(point.x) + 0.5, height)
    context.stroke()
    context.fillText(`${Math.round(x)} m`, point.x + 5, 16)
  }
  for (let z = startZ; z < topLeftZ + height / viewport.scale; z += spacing) {
    const point = worldToScreen(0, z)
    context.beginPath()
    context.moveTo(0, Math.round(point.y) + 0.5)
    context.lineTo(width, Math.round(point.y) + 0.5)
    context.stroke()
    context.fillText(`${Math.round(z)} m`, 6, point.y - 5)
  }
}

function yaw(rotation: MapEntity['rotation']): number {
  if (!rotation) return 0
  return Math.atan2(
    2 * (rotation.w * rotation.y + rotation.x * rotation.z),
    1 - 2 * (rotation.y * rotation.y + rotation.z * rotation.z),
  )
}

function draw(): void {
  const element = canvas.value
  const context = element?.getContext('2d')
  if (!element || !context) return
  const ratio = window.devicePixelRatio || 1
  const width = element.clientWidth
  const height = element.clientHeight
  if (element.width !== width * ratio || element.height !== height * ratio) {
    element.width = width * ratio
    element.height = height * ratio
  }
  context.setTransform(ratio, 0, 0, ratio, 0, 0)
  context.clearRect(0, 0, width, height)
  drawGrid(context, width, height)

  for (const entity of props.entities) {
    if (!entity.visible) continue
    const point = worldToScreen(entity.position.x, entity.position.z)
    const entityWidth = Math.max(entity.dimensions.x * viewport.scale, 5)
    const entityDepth = Math.max(entity.dimensions.z * viewport.scale, 5)
    if (
      point.x + entityWidth < 0 ||
      point.x - entityWidth > width ||
      point.y + entityDepth < 0 ||
      point.y - entityDepth > height
    )
      continue

    context.save()
    context.translate(point.x, point.y)
    context.rotate(-yaw(entity.rotation))
    context.fillStyle = colorFor(entity)
    context.globalAlpha = entity.type === 'Zone' ? 0.2 : 0.72
    context.fillRect(-entityWidth / 2, -entityDepth / 2, entityWidth, entityDepth)
    context.globalAlpha = 1
    context.strokeStyle = entity.id === props.selectedId ? '#ffffff' : colorFor(entity)
    context.lineWidth = entity.id === props.selectedId ? 3 : 1
    context.strokeRect(-entityWidth / 2, -entityDepth / 2, entityWidth, entityDepth)
    context.restore()

    if (viewport.scale > 1.6 || entity.id === props.selectedId) {
      context.fillStyle = '#f0f6f8'
      context.font = entity.id === props.selectedId ? '600 12px system-ui' : '11px system-ui'
      context.fillText(entity.name, point.x + entityWidth / 2 + 5, point.y + 4)
    }
  }
}

function pickEntity(clientX: number, clientY: number): MapEntity | null {
  const rectangle = canvas.value?.getBoundingClientRect()
  if (!rectangle) return null
  const x = clientX - rectangle.left
  const y = clientY - rectangle.top
  return (
    [...props.entities].reverse().find((entity) => {
      const point = worldToScreen(entity.position.x, entity.position.z)
      const halfWidth = Math.max(entity.dimensions.x * viewport.scale, 8) / 2
      const halfDepth = Math.max(entity.dimensions.z * viewport.scale, 8) / 2
      return Math.abs(x - point.x) <= halfWidth && Math.abs(y - point.y) <= halfDepth
    }) ?? null
  )
}

function onPointerDown(event: PointerEvent): void {
  canvas.value?.setPointerCapture(event.pointerId)
  drag = {
    x: event.clientX,
    y: event.clientY,
    centerX: viewport.centerX,
    centerZ: viewport.centerZ,
  }
  moved = false
}

function onPointerMove(event: PointerEvent): void {
  if (!drag) return
  const deltaX = event.clientX - drag.x
  const deltaY = event.clientY - drag.y
  moved ||= Math.abs(deltaX) + Math.abs(deltaY) > 4
  viewport.centerX = drag.centerX - deltaX / viewport.scale
  viewport.centerZ = drag.centerZ - deltaY / viewport.scale
  draw()
}

function onPointerUp(event: PointerEvent): void {
  if (!moved) emit('select', pickEntity(event.clientX, event.clientY))
  drag = null
}

function onWheel(event: WheelEvent): void {
  event.preventDefault()
  const element = canvas.value
  if (!element) return
  const rectangle = element.getBoundingClientRect()
  const mouseX = event.clientX - rectangle.left
  const mouseY = event.clientY - rectangle.top
  const worldX = viewport.centerX + (mouseX - element.clientWidth / 2) / viewport.scale
  const worldZ = viewport.centerZ + (mouseY - element.clientHeight / 2) / viewport.scale
  viewport.scale = Math.min(100, Math.max(0.02, viewport.scale * Math.exp(-event.deltaY * 0.0015)))
  viewport.centerX = worldX - (mouseX - element.clientWidth / 2) / viewport.scale
  viewport.centerZ = worldZ - (mouseY - element.clientHeight / 2) / viewport.scale
  draw()
}

onMounted(() => {
  resizeObserver = new ResizeObserver(() => draw())
  if (canvas.value) resizeObserver.observe(canvas.value)
  nextTick(fitWorld)
})
onBeforeUnmount(() => resizeObserver?.disconnect())
watch(() => [props.entities, props.selectedId], draw, { deep: true })
watch(() => props.bounds, fitWorld, { deep: true })

defineExpose({ fitWorld })
</script>

<template>
  <div class="map-shell">
    <canvas
      ref="canvas"
      aria-label="Top-down map of the Overte world"
      tabindex="0"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="drag = null"
      @wheel="onWheel"
    />
    <button class="fit-button" type="button" title="Fit world" @click="fitWorld">Fit map</button>
    <div class="axis" aria-hidden="true"><span>N</span><i></i></div>
  </div>
</template>

<style scoped>
.map-shell {
  position: relative;
  min-height: 30rem;
  overflow: hidden;
  background: #101a20;
}

canvas {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 30rem;
  cursor: grab;
  touch-action: none;
}

canvas:active {
  cursor: grabbing;
}

.fit-button {
  position: absolute;
  right: 1rem;
  bottom: 1rem;
  padding: 0.55rem 0.8rem;
  border: 1px solid #385261;
  border-radius: 0.5rem;
  color: #dbe9ee;
  background: rgb(15 28 35 / 88%);
  cursor: pointer;
}

.axis {
  position: absolute;
  top: 1rem;
  right: 1.2rem;
  display: grid;
  justify-items: center;
  color: #73d9c7;
  font-size: 0.7rem;
  font-weight: 800;
}

.axis i {
  width: 1px;
  height: 1.5rem;
  background: #73d9c7;
}
</style>
