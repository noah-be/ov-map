import { describe, expect, it } from 'vitest'

import { normalizeAddress } from '../../server/online-connector'

describe('normalizeAddress', () => {
  it.each([
    [' overte_hub ', 'overte_hub'],
    ['hifi://example.com', 'example.com'],
    ['HIFI://example.com:40102/path', 'example.com:40102/path'],
    ['127.0.0.1:40102', '127.0.0.1:40102'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeAddress(input)).toBe(expected)
  })

  it.each(['', '   ', 'https://example.com', 'domain name', 'domain<script>'])('rejects %j', (input) => {
    expect(() => normalizeAddress(input)).toThrow('Overte')
  })
})
