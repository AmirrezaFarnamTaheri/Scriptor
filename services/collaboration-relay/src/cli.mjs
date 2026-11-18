#!/usr/bin/env node
/** Explicit operator-only commands; never auto-started by Scriptor. */
import { lstatSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { RelayRoomStore } from './room-store.mjs'
import { startRelayServer } from './server.mjs'

export async function executeRelayCommand(command, env = process.env) {
  // Explicit env injection for test isolation, never store secrets in logging.
  const directory = env.SCRIPTOR_RELAY_DATA_DIR
  if (!directory) throw new Error('SCRIPTOR_RELAY_DATA_DIR is required')
  if (command === 'bootstrap') {
    const path = env.SCRIPTOR_RELAY_BOOTSTRAP_FILE
    if (!path) throw new Error('SCRIPTOR_RELAY_BOOTSTRAP_FILE is required')
    const file = lstatSync(path)
    if (!file.isFile() || file.isSymbolicLink() || file.size < 1 || file.size > 512 * 1024) {
      throw new Error('Invalid private bootstrap file')
    }
    if (process.platform !== 'win32' && (file.mode & 0o077)) {
      throw new Error('Bootstrap file must be private (0600)')
    }
    const bootstrap = JSON.parse(readFileSync(path, 'utf8'))
    if (!bootstrap || typeof bootstrap !== 'object' || Array.isArray(bootstrap) ||
      Object.keys(bootstrap).some(key => !['roomId','documentId','epoch','ownerPeerId','ownerPublicKey','initialUpdate'].includes(key))) {
      throw new Error('Invalid bootstrap document')
    }
    if (!bootstrap.ownerPublicKey) throw new Error('Bootstrap requires an Ed25519 owner public key')
    const store = new RelayRoomStore(directory)
    try { return store.createRoom(bootstrap) }
    finally { store.close() }
  }
  if (command === 'serve') {
    const port = Number(env.SCRIPTOR_RELAY_PORT ?? '8443')
    const allowedOrigins = (env.SCRIPTOR_RELAY_ALLOWED_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean)
    const store = new RelayRoomStore(directory)
    try {
      const server = await startRelayServer({
        store,
        host: env.SCRIPTOR_RELAY_HOST ?? '127.0.0.1',
        port,
        allowedOrigins,
        tls: { keyPath: env.SCRIPTOR_RELAY_TLS_KEY, certPath: env.SCRIPTOR_RELAY_TLS_CERT },
      })
      return { ...server, close: async () => { await server.close(); store.close() } }
    } catch (error) { store.close(); throw error }
  }
  throw new Error('Expected explicit command: bootstrap or serve')
}

// fileURLToPath decodes percent-escapes and Windows drive letters; URL.pathname
// does neither, so the CLI silently did nothing from such install paths.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  executeRelayCommand(process.argv[2]).then(result => {
    if (process.argv[2] === 'bootstrap') {
      process.stdout.write(`Created or verified room at durable cursor ${result.cursor}\n`)
    } else {
      process.stdout.write(`Scriptor collaboration WSS listener active at ${JSON.stringify(result.address())}\n`)
      const stop = () => { void result.close().finally(() => { process.exitCode = 0 }) }
      process.once('SIGINT', stop)
      process.once('SIGTERM', stop)
    }
  }).catch(error => {
    process.stderr.write(`Relay refused to start: ${error instanceof Error ? error.message : 'unknown error'}\n`)
    process.exitCode = 1
  })
}
