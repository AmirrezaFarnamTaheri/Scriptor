#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const vault = process.argv[2] ?? 'packages/test-fixtures/vaults/minimal'
const isWindows = process.platform === 'win32'

let socketDir = null
const socketName = isWindows
  ? `scriptor-smoke-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
  : (() => {
      socketDir = mkdtempSync(join(tmpdir(), 'scriptor-daemon-smoke-'))
      return join(socketDir, 'daemon.sock')
    })()

process.chdir(root)
console.log(`Starting scriptor-daemon on ${socketName}`)

const cargoDir = isWindows
  ? `${process.env.USERPROFILE || ''}\\.cargo\\bin`
  : `${process.env.HOME || ''}/.cargo/bin`
const env = {
  ...process.env,
  PATH: cargoDir ? `${cargoDir}${isWindows ? ';' : ':'}${process.env.PATH || ''}` : process.env.PATH,
}

const executableSuffix = isWindows ? '.exe' : ''
const cliBinary = join(root, 'target', 'debug', `scriptor${executableSuffix}`)
const daemonBinary = join(root, 'target', 'debug', `scriptor-daemon${executableSuffix}`)

function run(command, args, { quiet = false, timeout = 120_000 } = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    env,
    shell: false,
    stdio: quiet ? 'ignore' : 'inherit',
    timeout,
  })
  return result.status === 0
}

if (!run('cargo', ['build', '--locked', '-p', 'scriptor-cli', '-p', 'scriptor-daemon'])) {
  throw new Error('failed to build daemon smoke binaries')
}

const daemon = spawn(daemonBinary, ['serve', '--socket', socketName], {
  cwd: root,
  stdio: 'ignore',
  shell: false,
  env,
})

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

try {
  const readinessDeadline = Date.now() + 60_000
  let ready = false
  while (Date.now() < readinessDeadline && daemon.exitCode === null) {
    if (run(cliBinary, ['daemon', 'ping'], { quiet: true, timeout: 10_000 })) {
      ready = true
      break
    }
    await sleep(500)
  }
  if (!ready) {
    throw new Error('daemon did not become ready within 60 seconds')
  }
  console.log('Pinging daemon')
  if (!run(cliBinary, ['daemon', 'ping'])) {
    throw new Error('daemon ping failed after readiness')
  }
  console.log(`Running TUI smoke via daemon against ${vault}`)
  if (!run(cliBinary, ['tui', vault, '--smoke-test'])) {
    throw new Error('TUI smoke failed')
  }
} finally {
  if (!daemon.killed) {
    daemon.kill('SIGTERM')
  }
  if (socketDir) {
    rmSync(socketDir, { recursive: true, force: true })
  }
}
