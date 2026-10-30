#!/usr/bin/env node
// MAT-008: independently authenticated client processes, vault switch, daemon
// restart/reconnect, stale-vault denial and current-vault success.
// Run only on hosted verification workers; this is binary smoke, not a
// packaged desktop installation or live-user acceptance certificate.
import { spawn, spawnSync } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const scratch = mkdtempSync(join(tmpdir(), 'scriptor-mat008-process-'))
const win = process.platform === 'win32'
const suffix = win ? '.exe' : ''
const targetDir = join(root, 'target', 'debug')
const daemonBinary = join(targetDir, 'scriptor-daemon' + suffix)
const probeBinary = join(targetDir, 'examples', 'vault_status_probe' + suffix)
const key = randomBytes(32).toString('hex')
const id = randomUUID().replaceAll('-', '').slice(0, 12)
const env = { ...process.env, SCRIPTOR_TEST_DAEMON_HMAC_KEY: key }
if (win) env.APPDATA = join(scratch, 'data')
else env.XDG_DATA_HOME = join(scratch, 'data')

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
let daemon = null
let daemonError = ''
const clients = []

function assertKind(reply, kind, label) {
  if (reply.kind !== kind) {
    throw new Error(label + ': expected ' + kind + ', got ' + JSON.stringify(reply))
  }
}

function assertStaleDenied(reply, label) {
  if (reply.kind !== 'rpc_error' || !String(reply.message).includes('Git status vault identity mismatch')) {
    throw new Error(label + ': expected daemon vault-identity rejection, got ' + JSON.stringify(reply))
  }
}

function createProbe(label) {
  const child = spawn(probeBinary, [], { cwd: root, env, stdio: ['pipe', 'pipe', 'pipe'], shell: false })
  const reader = createInterface({ input: child.stdout, crlfDelay: Infinity })
  let pending = null
  let stderr = ''
  let closed = false
  child.stderr.on('data', part => { stderr = (stderr + String(part)).slice(-2048) })
  child.on('error', error => {
    closed = true
    if (pending) {
      const previous = pending
      pending = null
      clearTimeout(previous.timer)
      previous.reject(error)
    }
  })
  child.on('exit', code => {
    closed = true
    if (pending) {
      const previous = pending
      pending = null
      clearTimeout(previous.timer)
      previous.reject(new Error(label + ' exited (' + code + '): ' + stderr))
    }
  })
  reader.on('line', line => {
    if (!pending) return
    const previous = pending
    pending = null
    clearTimeout(previous.timer)
    try { previous.resolve(JSON.parse(line)) } catch (error) { previous.reject(error) }
  })
  const client = {
    pid: child.pid,
    async send(request) {
      if (closed || pending) throw new Error(label + ' not accepting a new request')
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending = null
          reject(new Error(label + ' RPC response deadline exceeded'))
        }, 20_000)
        pending = { resolve, reject, timer }
        child.stdin.write(JSON.stringify(request) + '\n', error => {
          if (error && pending) {
            clearTimeout(pending.timer)
            pending = null
            reject(error)
          }
        })
      })
    },
    async close() {
      if (closed) return
      child.stdin.end()
      const exit = once(child, 'exit').catch(() => {})
      await Promise.race([exit, delay(2_000)])
      if (!closed) child.kill('SIGKILL')
    },
  }
  clients.push(client)
  return client
}

function launchDaemon(phase) {
  const socket = win ? 'scriptor-mat008-' + id + '-' + phase : join(scratch, 'daemon-' + phase + '.sock')
  daemonError = ''
  daemon = spawn(daemonBinary, ['serve', '--socket', socket], {
    cwd: root, env, stdio: ['ignore', 'ignore', 'pipe'], shell: false,
  })
  daemon.stderr.on('data', part => { daemonError = (daemonError + String(part)).slice(-2048) })
  return daemon
}

async function stopDaemon() {
  const current = daemon
  daemon = null
  if (!current || current.exitCode !== null) return
  current.kill('SIGTERM')
  await Promise.race([once(current, 'exit').catch(() => {}), delay(3_000)])
  if (current.exitCode === null) {
    current.kill('SIGKILL')
    await Promise.race([once(current, 'exit').catch(() => {}), delay(2_000)])
  }
}

async function awaitPing(client, label) {
  const deadline = Date.now() + 45_000
  let last = null
  while (Date.now() < deadline) {
    last = await client.send({ action: 'ping' })
    if (last.kind === 'pong') return
    if (!daemon || daemon.exitCode !== null) throw new Error(label + ': daemon exited: ' + daemonError)
    await delay(250)
  }
  throw new Error(label + ': daemon not reachable: ' + JSON.stringify(last) + ' / ' + daemonError)
}

function readNonce() {
  const result = spawnSync(daemonBinary, ['endpoint'], {
    cwd: root, env, encoding: 'utf8', shell: false, timeout: 10_000,
  })
  if (result.error || result.status !== 0) {
    throw new Error('unable to read authenticated daemon endpoint: ' + String(result.stderr || result.error))
  }
  const value = JSON.parse(result.stdout)
  if (typeof value.nonce !== 'string' || value.nonce.length === 0) throw new Error('missing endpoint nonce')
  return value.nonce
}

async function main() {
  const build = spawnSync('cargo', ['build', '--locked', '-p', 'scriptor-daemon', '--bin', 'scriptor-daemon', '--example', 'vault_status_probe'], {
    cwd: root, env, stdio: 'inherit', shell: false, timeout: 600_000,
  })
  if (build.error || build.status !== 0) throw new Error('unable to build daemon and independent RPC probe')

  const pathA = join(scratch, 'vault-a')
  const pathB = join(scratch, 'vault-b')
  mkdirSync(pathA, { recursive: true })
  mkdirSync(pathB, { recursive: true })
  writeFileSync(join(pathA, 'a.md'), '# First vault\n')
  writeFileSync(join(pathB, 'b.md'), '# Second vault\n')

  const a = createProbe('client A')
  const b = createProbe('client B')
  if (!a.pid || !b.pid || a.pid === b.pid) throw new Error('probes must be separate OS processes')

  const first = launchDaemon('first')
  await awaitPing(a, 'first daemon')
  assertKind(await b.send({ action: 'ping' }), 'pong', 'second authenticated client')
  const firstNonce = readNonce()
  const openedA = await a.send({ action: 'open', path: pathA })
  assertKind(openedA, 'opened', 'A opens its vault')
  assertKind(await a.send({ action: 'status', expected_vault_id: openedA.vault_id }), 'status_ok', 'A current status')

  const openedB = await b.send({ action: 'open', path: pathB })
  assertKind(openedB, 'opened', 'B switches the daemon to its vault')
  if (openedA.vault_id === openedB.vault_id) throw new Error('distinct vaults yielded the same identity')
  assertStaleDenied(await a.send({ action: 'status', expected_vault_id: openedA.vault_id }), 'old A status after B switch')
  assertKind(await b.send({ action: 'status', expected_vault_id: openedB.vault_id }), 'status_ok', 'B current status')

  await stopDaemon()
  const second = launchDaemon('restarted')
  if (second.pid === first.pid) throw new Error('restart reused daemon PID; cannot prove separate process')
  assertKind(await a.send({ action: 'reset' }), 'reset', 'A resets authenticated connection')
  assertKind(await b.send({ action: 'reset' }), 'reset', 'B resets authenticated connection')
  await awaitPing(a, 'restarted daemon')
  assertKind(await b.send({ action: 'ping' }), 'pong', 'B authenticated after restart')
  const secondNonce = readNonce()
  if (secondNonce === firstNonce) throw new Error('daemon restart did not rotate the endpoint nonce')

  const reopenedB = await b.send({ action: 'open', path: pathB })
  assertKind(reopenedB, 'opened', 'B opens vault after daemon restart')
  assertStaleDenied(await a.send({ action: 'status', expected_vault_id: openedA.vault_id }), 'old A after restart')
  assertKind(await b.send({ action: 'status', expected_vault_id: reopenedB.vault_id }), 'status_ok', 'B status after restart')

  const reopenedA = await a.send({ action: 'open', path: pathA })
  assertKind(reopenedA, 'opened', 'A can switch back after restart')
  assertStaleDenied(await b.send({ action: 'status', expected_vault_id: reopenedB.vault_id }), 'B old status after A switch')
  assertKind(await a.send({ action: 'status', expected_vault_id: reopenedA.vault_id }), 'status_ok', 'A status after switch back')

  const source = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' })
  console.log(JSON.stringify({
    name: 'MAT-008 daemon binary authenticated multi-process restart acceptance',
    result: 'PASS',
    source_sha: source.status === 0 ? source.stdout.trim() : 'unknown',
    platform: process.platform,
    independent_client_processes: true,
    daemon_restarted_with_fresh_nonce: true,
    stale_status_denied_before_and_after_restart: true,
    current_status_succeeded_before_and_after_restart: true,
    scope: 'hosted binary-level smoke; packaged desktop acceptance remains separate',
  }, null, 2))
}

try {
  await main()
} catch (error) {
  console.error('MAT-008 multi-process regression FAILED: ' + String(error))
  process.exitCode = 1
} finally {
  await Promise.all(clients.map(client => client.close().catch(() => {})))
  await stopDaemon()
  rmSync(scratch, { recursive: true, force: true })
}
