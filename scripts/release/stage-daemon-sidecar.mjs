#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const outDir = join(root, process.argv[2] ?? 'apps/desktop/src-tauri/binaries')

process.chdir(root)
console.log('==> Build scriptor-daemon release binary')
execSync('cargo build -p scriptor-daemon --release', { stdio: 'inherit' })

const isWindows = process.platform === 'win32'
const binaryName = isWindows ? 'scriptor-daemon.exe' : 'scriptor-daemon'
const source = join(root, 'target/release', binaryName)

if (!existsSync(source)) {
  console.error(`Daemon binary not found: ${source}`)
  process.exit(1)
}

mkdirSync(outDir, { recursive: true })
const dest = join(outDir, binaryName)
copyFileSync(source, dest)
console.log(`Staged daemon sidecar at ${dest}`)
