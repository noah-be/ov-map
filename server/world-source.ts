import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import type { WorldMapData } from '../shared/world.js'
import { parseWorldBuffer } from './world-parser.js'

const MAX_DOWNLOAD_BYTES = 64 * 1024 * 1024

async function readRemoteSource(url: URL): Promise<Buffer> {
  const response = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!response.ok) throw new Error(`World source returned HTTP ${response.status}`)
  const declaredSize = Number(response.headers.get('content-length'))
  if (declaredSize > MAX_DOWNLOAD_BYTES) throw new Error('World source exceeds 64 MiB limit')
  const body = Buffer.from(await response.arrayBuffer())
  if (body.byteLength > MAX_DOWNLOAD_BYTES) throw new Error('World source exceeds 64 MiB limit')
  return body
}

export async function loadWorld(source: string): Promise<WorldMapData> {
  if (/^https?:\/\//i.test(source)) {
    return parseWorldBuffer(await readRemoteSource(new URL(source)), source)
  }

  const absolutePath = resolve(source)
  return parseWorldBuffer(await readFile(absolutePath), absolutePath)
}
