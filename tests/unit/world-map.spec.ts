import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import WorldMap from '../../src/components/WorldMap.vue'
import { entity } from '../fixtures/world'

const context = {
  setTransform: vi.fn<(a: number, b: number, c: number, d: number, e: number, f: number) => void>(),
  clearRect: vi.fn<(x: number, y: number, width: number, height: number) => void>(),
  beginPath: vi.fn<() => void>(),
  moveTo: vi.fn<(x: number, y: number) => void>(),
  lineTo: vi.fn<(x: number, y: number) => void>(),
  stroke: vi.fn<() => void>(),
  fill: vi.fn<() => void>(),
  fillText: vi.fn<(text: string, x: number, y: number) => void>(),
  save: vi.fn<() => void>(),
  restore: vi.fn<() => void>(),
  translate: vi.fn<(x: number, y: number) => void>(),
  rotate: vi.fn<(angle: number) => void>(),
  fillRect: vi.fn<(x: number, y: number, width: number, height: number) => void>(),
  strokeRect: vi.fn<(x: number, y: number, width: number, height: number) => void>(),
  arc: vi.fn<(x: number, y: number, radius: number, start: number, end: number) => void>(),
  strokeStyle: '',
  fillStyle: '',
  lineWidth: 1,
  font: '',
  globalAlpha: 1,
}

class ResizeObserverMock {
  observe = vi.fn<(element: Element) => void>()
  disconnect = vi.fn<() => void>()
}

function mountMap() {
  const wrapper = mount(WorldMap, {
    props: {
      entities: [
        entity({
          id: 'center',
          position: { x: 0, y: 0, z: 0 },
          dimensions: { x: 4, y: 2, z: 4 },
          color: { red: 1, green: 2, blue: 3 },
        }),
        entity({ id: 'hidden', visible: false }),
      ],
      bounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 },
      selectedId: null,
      avatars: [{
        id: 'avatar',
        displayName: 'Ada',
        position: { x: 2, y: 0, z: 2 },
        orientation: { x: 0, y: 0, z: 0, w: 1 },
      }],
    },
  })
  const canvas = wrapper.get('canvas').element
  Object.defineProperties(canvas, {
    clientWidth: { configurable: true, value: 400 },
    clientHeight: { configurable: true, value: 300 },
  })
  canvas.getBoundingClientRect = () => ({
    x: 0, y: 0, left: 0, top: 0, right: 400, bottom: 300,
    width: 400, height: 300, toJSON: () => ({}),
  })
  canvas.setPointerCapture = vi.fn<(pointerId: number) => void>()
  return { wrapper, canvas }
}

function pointer(element: Element, type: string, clientX: number, clientY: number): void {
  element.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX, clientY }))
}

beforeEach(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverMock)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    context as unknown as CanvasRenderingContext2D,
  )
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    callback(0)
    return 1
  })
  for (const value of Object.values(context)) if (typeof value === 'function') value.mockClear()
})

afterEach(() => vi.restoreAllMocks())

describe('WorldMap', () => {
  it('fits and draws visible entities and avatars', async () => {
    const { wrapper } = mountMap()
    await wrapper.vm.$nextTick()
    wrapper.vm.fitWorld()

    expect(context.fillRect).toHaveBeenCalled()
    expect(context.arc).toHaveBeenCalled()
    expect(context.fillText).toHaveBeenCalledWith('Ada', expect.any(Number), expect.any(Number))
    expect(context.fillRect).not.toHaveBeenCalledWith(
      expect.any(Number), expect.any(Number), 40, 30,
    )
  })

  it('zooms with buttons and the mouse wheel', async () => {
    const { wrapper } = mountMap()
    await wrapper.vm.$nextTick()
    const drawsBefore = context.clearRect.mock.calls.length

    await wrapper.get('[aria-label="Zoom in"]').trigger('click')
    await wrapper.get('[aria-label="Zoom out"]').trigger('click')
    wrapper.get('canvas').element.dispatchEvent(new WheelEvent('wheel', {
      bubbles: true,
      clientX: 200,
      clientY: 150,
      deltaY: -100,
    }))

    expect(context.clearRect.mock.calls.length).toBeGreaterThan(drawsBefore)
  })

  it('selects a clicked entity and clears selection on empty space', async () => {
    const { wrapper } = mountMap()
    await wrapper.vm.$nextTick()
    wrapper.vm.fitWorld()
    const canvas = wrapper.get('canvas')

    pointer(canvas.element, 'pointerdown', 200, 150)
    pointer(canvas.element, 'pointerup', 200, 150)
    expect(wrapper.emitted('select')?.[0]?.[0]).toMatchObject({ id: 'center' })

    pointer(canvas.element, 'pointerdown', 5, 5)
    pointer(canvas.element, 'pointerup', 5, 5)
    expect(wrapper.emitted('select')?.[1]?.[0]).toBeNull()
  })

  it('pans while dragging without selecting an entity', async () => {
    const { wrapper } = mountMap()
    const canvas = wrapper.get('canvas')
    pointer(canvas.element, 'pointerdown', 200, 150)
    pointer(canvas.element, 'pointermove', 230, 180)
    pointer(canvas.element, 'pointerup', 230, 180)
    expect(wrapper.emitted('select')).toBeUndefined()
  })

  it('disconnects its resize observer when unmounted', () => {
    const { wrapper } = mountMap()
    expect(() => wrapper.unmount()).not.toThrow()
  })
})
