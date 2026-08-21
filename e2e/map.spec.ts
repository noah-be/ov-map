import { expect, test, type Page } from '@playwright/test'

const initialWorld = {
  source: 'e2e-world',
  loadedAt: '2026-08-21T12:00:00.000Z',
  version: 65,
  entityCount: 3,
  bounds: { minX: -20, maxX: 20, minZ: -20, maxZ: 20 },
  types: { Model: 1, Shape: 1, Text: 1 },
  entities: [
    {
      id: 'plaza', name: 'Welcome Plaza', type: 'Model',
      position: { x: -8, y: 0, z: -5 }, dimensions: { x: 8, y: 2, z: 8 },
      rotation: null, parentId: null, visible: true, color: null,
      modelUrl: null, imageUrl: null, description: 'The central plaza',
    },
    {
      id: 'unnamed', name: 'Unnamed Shape', type: 'Shape',
      position: { x: 8, y: 0, z: 5 }, dimensions: { x: 6, y: 2, z: 6 },
      rotation: null, parentId: null, visible: true,
      color: { red: 255, green: 0, blue: 0 },
      modelUrl: null, imageUrl: null, description: null,
    },
    {
      id: 'info', name: 'Information', type: 'Text',
      position: { x: 0, y: 0, z: 10 }, dimensions: { x: 5, y: 2, z: 2 },
      rotation: null, parentId: null, visible: true, color: null,
      modelUrl: null, imageUrl: null, description: null,
    },
  ],
  avatars: [],
}

async function mockApi(page: Page): Promise<{ worldRequests: () => number }> {
  let requests = 0
  await page.route('**/api/world', async (route) => {
    requests += 1
    await route.fulfill({ json: { ...initialWorld, loadedAt: new Date().toISOString() } })
  })
  await page.route('**/api/connection', (route) => route.fulfill({
    json: { state: 'idle', address: null, message: 'Ready to connect', startedAt: null },
  }))
  return { worldRequests: () => requests }
}

test('loads once and refreshes only after the user asks', async ({ page }) => {
  const api = await mockApi(page)
  await page.goto('/')

  await expect(page.getByText('3', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Top-down map of the Overte world')).toBeVisible()
  expect(api.worldRequests()).toBe(1)

  await page.waitForTimeout(1_200)
  expect(api.worldRequests()).toBe(1)
  await page.getByRole('button', { name: 'Refresh' }).click()
  await expect.poll(api.worldRequests).toBe(2)
})

test('searches and filters layers without reloading the world', async ({ page }) => {
  const api = await mockApi(page)
  await page.goto('/')
  const canvas = page.getByLabel('Top-down map of the Overte world')
  await expect(canvas).toBeVisible()
  const initial = await canvas.screenshot()

  await page.getByRole('checkbox', { name: /Hide unnamed entities/ }).check()
  const filtered = await canvas.screenshot()
  expect(filtered.equals(initial)).toBe(false)

  await page.getByPlaceholder('Name or type').fill('Information')
  const searched = await canvas.screenshot()
  expect(searched.equals(filtered)).toBe(false)
  expect(api.worldRequests()).toBe(1)

  await page.getByRole('button', { name: 'Show all' }).click()
  await expect(page.getByRole('checkbox', { name: /Hide unnamed entities/ })).not.toBeChecked()
})

test('supports button zoom and fit controls', async ({ page }) => {
  await mockApi(page)
  await page.goto('/')
  const canvas = page.getByLabel('Top-down map of the Overte world')
  await expect(canvas).toBeVisible()
  const initial = await canvas.screenshot()

  await page.getByRole('button', { name: 'Zoom in' }).click()
  const zoomed = await canvas.screenshot()
  expect(zoomed.equals(initial)).toBe(false)
  await page.getByRole('button', { name: 'Zoom out' }).click()
  await page.getByRole('button', { name: 'Fit map' }).click()
})

test('shows a load error and retries successfully', async ({ page }) => {
  let attempts = 0
  await page.route('**/api/world', async (route) => {
    attempts += 1
    if (attempts === 1) await route.fulfill({ status: 503, json: { error: 'World unavailable' } })
    else await route.fulfill({ json: initialWorld })
  })
  await page.route('**/api/connection', (route) => route.fulfill({
    json: { state: 'idle', address: null, message: 'Ready', startedAt: null },
  }))

  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText('World unavailable')
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByLabel('Top-down map of the Overte world')).toBeVisible()
  expect(attempts).toBe(2)
})

test('connects to a world and replaces the map after polling completes', async ({ page }) => {
  let connectionPolls = 0
  let connected = false
  await page.route('**/api/world', (route) => route.fulfill({
    json: connected ? { ...initialWorld, source: 'new-world', entityCount: 1, entities: [initialWorld.entities[0]], types: { Model: 1 } } : initialWorld,
  }))
  await page.route('**/api/connect', async (route) => {
    connected = true
    await route.fulfill({ status: 202, json: { state: 'connecting', address: 'new-world', message: 'Connecting…', startedAt: new Date().toISOString() } })
  })
  await page.route('**/api/connection', (route) => {
    connectionPolls += 1
    return route.fulfill({ json: connected
      ? { state: 'complete', address: 'new-world', message: 'Live: 1 entities, 0 avatars', startedAt: new Date().toISOString() }
      : { state: 'idle', address: null, message: 'Ready', startedAt: null } })
  })

  await page.goto('/')
  await page.getByLabel('Online world').fill('new-world')
  await page.getByRole('button', { name: 'Connect' }).click()
  await expect(page.getByText('Live: 1 entities, 0 avatars')).toBeVisible({ timeout: 5_000 })
  await expect(page.locator('.world-status strong')).toHaveText('1')
  expect(connectionPolls).toBeGreaterThanOrEqual(2)
})
