import { afterEach, describe, it, expect, vi } from 'vitest'
import { createPinia } from 'pinia'
import { nextTick } from 'vue'

import { flushPromises, mount } from '@vue/test-utils'
import App from '../App.vue'
import { entity, world } from '../../tests/fixtures/world'

const WorldMapStub = {
  props: ['entities'],
  template: '<div data-test="map">{{ entities.length }} visible</div>',
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status })
}

afterEach(() => vi.unstubAllGlobals())

describe('App', () => {
  it('introduces the project', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => undefined)),
    )
    const wrapper = mount(App, { global: { plugins: [createPinia()] } })
    await nextTick()
    expect(wrapper.get('h1').text()).toBe('ov-map')
    expect(wrapper.text()).toContain('Unofficial Overte community project')
    expect(wrapper.text()).toContain('Loading world data')
  })

  it('renders loaded world metadata and applies UI filters', async () => {
    const data = world({ entities: [
      entity({ id: 'named', name: 'Plaza', type: 'Model' }),
      entity({ id: 'unnamed', name: 'Unnamed Shape', type: 'Shape' }),
    ] })
    vi.stubGlobal('fetch', vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(data))
      .mockResolvedValueOnce(jsonResponse({ state: 'idle', address: null, message: 'Ready', startedAt: null })))
    const wrapper = mount(App, {
      global: { plugins: [createPinia()], stubs: { WorldMap: WorldMapStub } },
    })
    await flushPromises()

    expect(wrapper.find('.world-status').text()).toContain('2')
    expect(wrapper.get('[data-test="map"]').text()).toBe('2 visible')
    await wrapper.get('input[type="checkbox"]').setValue(true)
    expect(wrapper.get('[data-test="map"]').text()).toBe('1 visible')
    await wrapper.get('input[type="search"]').setValue('missing')
    expect(wrapper.get('[data-test="map"]').text()).toBe('0 visible')
  })

  it('shows API errors and retries from the error notice', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ error: 'Unavailable' }, 503))
      .mockResolvedValueOnce(jsonResponse({ state: 'idle', address: null, message: 'Ready', startedAt: null }))
      .mockResolvedValueOnce(jsonResponse(world())))
    const wrapper = mount(App, {
      global: { plugins: [createPinia()], stubs: { WorldMap: WorldMapStub } },
    })
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('Unavailable')
    await wrapper.get('[role="alert"] button').trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.get('[data-test="map"]').text()).toBe('1 visible')
  })
})
