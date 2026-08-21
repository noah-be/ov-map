import { access } from 'node:fs/promises'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import { spawn, type ChildProcess } from 'node:child_process'

export type ConnectionState = 'idle' | 'connecting' | 'complete' | 'error'

export interface ConnectionStatus {
  state: ConnectionState
  address: string | null
  message: string
  startedAt: string | null
}

type SnapshotHandler = (snapshot: unknown, address: string) => void

function connectorCandidates(root: string): string[] {
  return [
    process.env.OV_MAP_CONNECTOR_PATH,
    resolve(root, '../overte/build-connector/native/tools/ov-map-connector/Release/ov-map-connector'),
    resolve(homedir(), '.local/bin/ov-map-connector'),
    '/usr/local/bin/ov-map-connector',
  ].filter((candidate): candidate is string => Boolean(candidate))
}

async function findConnector(root: string): Promise<string | null> {
  for (const candidate of connectorCandidates(root)) {
    try {
      await access(candidate)
      return candidate
    } catch {
      // Try the next supported location.
    }
  }
  return null
}

export function normalizeAddress(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) throw new Error('Enter an Overte place name or domain address')
  const withoutScheme = trimmed.replace(/^hifi:\/\//i, '')
  if (!/^[\w.-]+(?::\d+)?(?:\/.*)?$/u.test(withoutScheme)) {
    throw new Error('Invalid Overte address')
  }
  return withoutScheme
}

export class OnlineConnector {
  #process: ChildProcess | null = null
  #onSnapshot: SnapshotHandler
  #status: ConnectionStatus = {
    state: 'idle',
    address: null,
    message: 'Ready to connect',
    startedAt: null,
  }

  constructor(onSnapshot: SnapshotHandler) {
    this.#onSnapshot = onSnapshot
  }

  get status(): ConnectionStatus {
    return this.#status
  }

  disconnect(): void {
    if (this.#process && this.#process.exitCode === null) this.#process.kill('SIGTERM')
    this.#process = null
    this.#status = {
      state: 'idle',
      address: null,
      message: 'Ready to connect',
      startedAt: null,
    }
  }

  async connect(input: string, root: string): Promise<ConnectionStatus> {
    const address = normalizeAddress(input)
    const executable = await findConnector(root)
    if (!executable) {
      throw new Error('Headless connector not found. Set OV_MAP_CONNECTOR_PATH to its executable.')
    }

    if (this.#process && this.#process.exitCode === null) this.#process.kill('SIGTERM')
    this.#status = {
      state: 'connecting',
      address,
      message: `Connecting anonymously to ${address}…`,
      startedAt: new Date().toISOString(),
    }

    const child = spawn(executable, ['--domain', address], {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    this.#process = child
    let stdout = ''
    let diagnostic = ''

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString()
      const lines = stdout.split('\n')
      stdout = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const event = JSON.parse(line) as Record<string, unknown>
          if (event.type === 'connection.error') {
            this.#status = { ...this.#status, state: 'error', message: String(event.message) }
          } else if (event.type === 'world.snapshot' && event.connected === true) {
            this.#onSnapshot(event, address)
            const entities = Array.isArray(event.entities) ? event.entities.length : 0
            const avatars = Array.isArray(event.avatars) ? event.avatars.length : 0
            this.#status = {
              ...this.#status,
              state: 'complete',
              message: `Live: ${entities} entities, ${avatars} avatars`,
            }
          }
        } catch (error) {
          diagnostic = `${diagnostic}\n${error instanceof Error ? error.message : String(error)}`.slice(-2000)
        }
      }
    })
    child.stderr.on('data', (chunk: Buffer) => {
      diagnostic = `${diagnostic}${chunk.toString()}`.slice(-2000)
    })
    child.once('error', (error) => {
      this.#status = { ...this.#status, state: 'error', message: error.message }
    })
    child.once('exit', (code) => {
      if (this.#process !== child) return
      if (this.#status.state !== 'error') {
        const diagnostics = diagnostic.trim().split('\n')
        this.#status = {
          ...this.#status,
          state: 'error',
          message: diagnostics[diagnostics.length - 1] || `Connector exited (${code})`,
        }
      }
      this.#process = null
    })

    return this.#status
  }
}
