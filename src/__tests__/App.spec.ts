import { describe, it, expect, vi } from 'vitest'
import { createPinia } from 'pinia'
import { nextTick } from 'vue'

import { mount } from '@vue/test-utils'
import App from '../App.vue'

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
})
