/** Production WSS listener. Never starts without explicitly configured TLS. */
import { lstatSync, readFileSync } from 'node:fs'
import { createServer } from 'node:https'
import { resolve } from 'node:path'
import { RelaySessionHub } from './session-hub.mjs'

const SUBPROTOCOL = 'scriptor-live-v1'
const MAX_MESSAGE = 512 * 1024

export function validateRelayUpgrade(req, allowedOrigins = []) {
  if (req.method !== 'GET') throw new Error('Expected WebSocket GET method')
  // Do not accept URL tokens or unversioned protocol endpoints.
  if (req.url !== '/v1/live') throw new Error('Invalid relay WebSocket path')
  if (req.headers.upgrade?.toLowerCase() !== 'websocket' ||
      !req.headers.connection?.toLowerCase().split(',').map(value => value.trim()).includes('upgrade')) {
    throw new Error('Invalid WebSocket upgrade headers')
  }
  if (req.headers['sec-websocket-protocol'] !== SUBPROTOCOL) throw new Error('Unsupported WebSocket subprotocol')
  // A missing Origin is valid for an explicitly authenticated native client;
  // browser origins must be allowed by the operator, never by CORS wildcards.
  if (req.headers.origin && !allowedOrigins.includes(req.headers.origin)) throw new Error('Disallowed WebSocket Origin')
}

function readTrustedTlsFile(filename, maxBytes, privateKey = false) {
  if (typeof filename !== 'string' || filename.length < 2) throw new Error('TLS certificate/key file required')
  const full = resolve(filename)
  const info = lstatSync(full)
  if (!info.isFile() || info.isSymbolicLink() || info.size < 1 || info.size > maxBytes) {
    throw new Error('Unsafe TLS certificate/key file')
  }
  // POSIX private keys must not be readable by group or world. On Windows the
  // operator must configure file ACLs; POSIX mode bits are not meaningful.
  if (privateKey && process.platform !== 'win32' && (info.mode & 0o077)) {
    throw new Error('TLS private key file permissions must be 0600')
  }
  return readFileSync(full)
}

export function validateTlsConfiguration({ keyPath, certPath } = {}) {
  return { key: readTrustedTlsFile(keyPath, 32 * 1024, true),
    cert: readTrustedTlsFile(certPath, 128 * 1024) }
}

/**
 * WebSocket implementation is supplied by the well-maintained ws package, not
 * custom frame parsing. This function is only called by explicit operator
 * startup; importing this module cannot create listeners or read vaults.
 */
export async function startRelayServer({
  store, tls, host = '127.0.0.1', port = 8443, allowedOrigins = [], maxSessions = 256,
  WebSocketServerClass,
} = {}) {
  if (!store || !Array.isArray(allowedOrigins) ||
      allowedOrigins.some(v => typeof v !== 'string' || !(/^(?:https?:\/\/|app:\/\/|tauri:\/\/)/.test(v))) ||
      typeof host !== 'string' || !host || host.length > 255 ||
      !Number.isSafeInteger(port) || port < 0 || port > 65535) {
    throw new Error('Invalid WSS relay configuration')
  }
  const verifiedTls = validateTlsConfiguration(tls)
  const Impl = WebSocketServerClass ?? (await import('ws')).WebSocketServer
  const hub = new RelaySessionHub({ store, maxSessions })
  const http = createServer({ ...verifiedTls, minVersion: 'TLSv1.2', maxHeaderSize: 8192 }, (_req, res) => {
    res.writeHead(404, { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain' })
    res.end('Not found')
  })
  const wss = new Impl({ noServer: true, perMessageDeflate: false, maxPayload: MAX_MESSAGE,
    clientTracking: true })
  http.on('upgrade', (req, socket, head) => {
    try {
      validateRelayUpgrade(req, allowedOrigins)
      wss.handleUpgrade(req, socket, head, client => hub.accept(client))
    } catch {
      // Do not reflect untrusted input or reveal membership/credentials to HTTP.
      if (!socket.destroyed) socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n')
    }
  })
  http.on('clientError', (_error, socket) => { if (!socket.destroyed) socket.destroy() })
  try {
    await new Promise((ok, fail) => {
      http.once('error', fail)
      http.listen(port, host, () => { http.removeListener('error', fail); ok() })
    })
  } catch (error) {
    hub.close()
    wss.close()
    throw error
  }
  return {
    address: () => http.address(),
    close: async () => {
      hub.close()
      await new Promise(resolveClose => {
        wss.close(() => resolveClose())
        for (const client of wss.clients ?? []) client.terminate?.()
      })
      await new Promise(resolveClose => http.close(() => resolveClose()))
    },
  }
}
