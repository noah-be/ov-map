import { describe, it, expect } from 'vitest'

import { mount } from '@vue/test-utils'
import App from '../App.vue'

describe('App', () => {
  it('introduces the project', () => {
    const wrapper = mount(App)
    expect(wrapper.get('h1').text()).toBe('ov-map')
    expect(wrapper.text()).toContain('Unofficial Overte community project')
  })
})
