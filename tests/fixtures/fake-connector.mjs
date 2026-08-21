#!/usr/bin/env node

const domainIndex = process.argv.indexOf('--domain')
const domain = process.argv[domainIndex + 1]

if (domain === 'connection-error') {
  console.log(JSON.stringify({ type: 'connection.error', message: 'Domain rejected connection' }))
} else {
  console.log('not-json')
  console.log(
    JSON.stringify({
      type: 'world.snapshot',
      connected: true,
      timestamp: '2026-08-21T12:00:00.000Z',
      entities: [{ id: 'live-1', name: 'Live entity', type: 'Model' }],
      avatars: [{ id: 'avatar-1', displayName: 'Ada' }],
    }),
  )
}

setInterval(() => {}, 1_000)
