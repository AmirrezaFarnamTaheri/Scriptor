#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { execSync } from 'node:child_process'
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

const daemon = spawn('cargo', ['run', '-p', 'scriptor-daemon', '--', 'serve', '--socket', socketName], {
  cwd: root,
  stdio: 'ignore',
  shell: isWindows,
})

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function run(command) {
  execSync(command, { cwd: root, stdio: 'inherit', shell: isWindows })
}

try {
  await sleep(4000)
  console.log('Pinging daemon')
  run('cargo run -p scriptor-cli -- daemon ping')
  console.log(`Running TUI smoke via daemon against ${vault}`)
  run(`cargo run -p scriptor-cli -- tui ${vault} --smoke-test --via-daemon`)
} finally {
  if (!daemon.killed) {
    daemon.kill('SIGTERM')
  }
  if (socketDir) {
    rmSync(socketDir, { recursive: true, force: true })
  }
}
