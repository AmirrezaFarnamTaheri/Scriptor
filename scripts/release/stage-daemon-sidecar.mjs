#!/usr/bin/env node
/**
 * stage-daemon-sidecar.mjs
 *
 * Stages the scriptor-daemon binary into apps/desktop/src-tauri/binaries/
 * so Tauri can embed it as a sidecar.
 *
 * Modes (controlled by --source):
 *
 *   github-release  (default in CI when GITHUB_TOKEN is set)
 *     Fetches the pre-built binary from the latest GitHub Release.
 *     Much faster than a local cargo build; avoids needing a Rust toolchain
 *     on the packaging machine.
 *
 *   local  (default when GITHUB_TOKEN is absent, i.e. local dev)
 *     Builds the daemon with `cargo build -p scriptor-daemon --release`.
 *     Requires a full Rust toolchain on PATH.
 *
 * Options:
 *   --source   github-release | local      (auto-detected if omitted)
 *   --tag      latest | v0.x.y             (only relevant for github-release)
 *   --out-dir  apps/desktop/src-tauri/binaries
 *   --repo     AmirrezaFarnamTaheri/Scriptor
 *
 * Environment:
 *   GITHUB_TOKEN           – when set, enables authenticated GH API calls
 *   SCRIPTOR_SKIP_GH_DOWNLOAD – set to "true" to force local build even in CI
 */

import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync, spawnSync } from 'node:child_process'

const root   = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const isWin  = process.platform === 'win32'
const binary = isWin ? 'scriptor-daemon.exe' : 'scriptor-daemon'

// ── arg parsing ───────────────────────────────────────────────────────────────

function arg(name, fallback) {
  const idx = process.argv.indexOf(`--${name}`)
  if (idx !== -1 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith('--')) {
    return process.argv[idx + 1]
  }
  return fallback
}

const outDir = resolve(root, arg('out-dir', 'apps/desktop/src-tauri/binaries'))
const repo   = arg('repo', 'AmirrezaFarnamTaheri/Scriptor')
const tag    = arg('tag',  'latest')

// Auto-detect source: use GH release in CI (GITHUB_TOKEN present) unless overridden.
const defaultSource = (process.env.GITHUB_TOKEN && process.env.SCRIPTOR_SKIP_GH_DOWNLOAD !== 'true')
  ? 'github-release'
  : 'local'
const source = arg('source', defaultSource)

// ── asset naming convention ───────────────────────────────────────────────────
// GitHub Release assets are named:  scriptor-daemon-<os>-<arch>.exe?
// We map the current runtime platform to the expected asset name.

const osSuffix   = isWin ? 'windows' : process.platform === 'darwin' ? 'macos' : 'linux'
const archSuffix = process.arch === 'arm64' ? 'aarch64' : 'x86_64'
const assetName  = isWin
  ? `scriptor-daemon-${osSuffix}-${archSuffix}.exe`
  : `scriptor-daemon-${osSuffix}-${archSuffix}`

// ── ensure output directory ───────────────────────────────────────────────────

mkdirSync(outDir, { recursive: true })
const dest = join(outDir, binary)

// ── mode: github-release ──────────────────────────────────────────────────────

if (source === 'github-release') {
  console.log(`==> Fetching daemon sidecar from GitHub Release (${tag})`)
  const fetcher = join(root, 'scripts/release/fetch-github-release-asset.mjs')
  const result = spawnSync(
    process.execPath,
    [fetcher, '--repo', repo, '--tag', tag, '--asset', assetName, '--out', dest],
    { stdio: 'inherit', cwd: root },
  )
  if (result.status !== 0) {
    console.error('GitHub download failed — falling back to local cargo build')
    buildLocally()
  } else {
    console.log(`Staged daemon sidecar (from GH Release) at ${dest}`)
  }
} else {
  buildLocally()
}

// ── mode: local ───────────────────────────────────────────────────────────────

function buildLocally() {
  console.log('==> Build scriptor-daemon release binary (local cargo build)')
  process.chdir(root)
  execSync('cargo build -p scriptor-daemon --release', { stdio: 'inherit' })

  const source = join(root, 'target/release', binary)
  if (!existsSync(source)) {
    console.error(`Daemon binary not found: ${source}`)
    process.exit(1)
  }

  copyFileSync(source, dest)
  console.log(`Staged daemon sidecar (from local build) at ${dest}`)
}
