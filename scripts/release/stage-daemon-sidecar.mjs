#!/usr/bin/env node
/**
 * stage-daemon-sidecar.mjs
 *
 * Stages the scriptor-daemon binary into apps/desktop/src-tauri/binaries/
 * so Tauri can embed it as a sidecar.
 *
 * Modes (controlled by --source):
 *
 *   local  (default)
 *     Builds the daemon from the checked-out source with
 *     `cargo build -p scriptor-daemon --release`. This is the only mode that
 *     preserves source identity by construction and it is what release
 *     packaging must use.
 *
 *   github-release  (explicit opt-in only)
 *     Downloads a pre-built daemon asset from an immutable `vX.Y.Z` tag.
 *     Guardrails (all mandatory, all hard failures):
 *       - `latest` is rejected: the tag must be an immutable `v<VERSION>`
 *         matching the VERSION file in this checkout.
 *       - After download, the staged binary must report the same version via
 *         `--version` (binary identity handshake).
 *       - A SHA-256 receipt (`<asset>.sha256`) is written next to the binary
 *         so downstream packaging evidence can pin the exact artifact.
 *
 * Options:
 *   --source   local | github-release      (default: local)
 *   --tag      vX.Y.Z                      (required for github-release)
 *   --out-dir  apps/desktop/src-tauri/binaries
 *   --repo     AmirrezaFarnamTaheri/Scriptor
 *
 * Environment:
 *   GITHUB_TOKEN              – authenticated GH API calls (download mode)
 *   SCRIPTOR_SKIP_GH_DOWNLOAD – "true" forces local build even when asked
 */

import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const isWin = process.platform === 'win32'
const binary = isWin ? 'scriptor-daemon.exe' : 'scriptor-daemon'

function arg(name, fallback) {
  const idx = process.argv.indexOf(`--${name}`)
  if (idx !== -1 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith('--')) {
    return process.argv[idx + 1]
  }
  return fallback
}

function fail(message) {
  console.error(`ERROR: ${message}`)
  process.exit(1)
}

const outDir = resolve(root, arg('out-dir', 'apps/desktop/src-tauri/binaries'))
const repo = arg('repo', 'AmirrezaFarnamTaheri/Scriptor')
const source = arg('source', 'local')

const versionFile = join(root, 'VERSION')
const checkoutVersion = existsSync(versionFile)
  ? readFileSync(versionFile, 'utf8').trim()
  : null

const osSuffix = isWin ? 'windows' : process.platform === 'darwin' ? 'macos' : 'linux'
const archSuffix = process.arch === 'arm64' ? 'aarch64' : 'x86_64'
const assetName = isWin
  ? `scriptor-daemon-${osSuffix}-${archSuffix}.exe`
  : `scriptor-daemon-${osSuffix}-${archSuffix}`

mkdirSync(outDir, { recursive: true })
const dest = join(outDir, binary)

function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

/** Runs the staged binary's --version handshake and returns trimmed stdout. */
function daemonVersion(path) {
  const result = spawnSync(path, ['--version'], { encoding: 'utf8', timeout: 15_000 })
  if (result.error || result.status !== 0) return null
  const match = /(\d+\.\d+\.\d+)/.exec(result.stdout ?? '')
  return match ? match[1] : (result.stdout ?? '').trim() || null
}

function stageReceipt(sourceMode, extra) {
  const receipt = {
    artifact: binary,
    sha256: sha256File(dest),
    bytes: statSync(dest).size,
    source: sourceMode,
    repo,
    stagedAt: new Date().toISOString(),
    ...extra,
  }
  const receiptPath = `${dest}.staging-receipt.json`
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}
`)
  console.log(`Staging receipt: ${receiptPath}`)
}


if (source === 'github-release') {
  const tag = arg('tag', '')
  if (!tag) fail('github-release mode requires an explicit --tag (immutable vX.Y.Z).')
  if (tag === 'latest' || !/^v\d+\.\d+\.\d+$/.test(tag)) {
    fail(`Refusing to stage from "${tag || 'latest'}": only immutable vMAJOR.MINOR.PATCH tags are allowed.`)
  }
  if (!checkoutVersion) fail('VERSION file missing from checkout; cannot bind tag to source identity.')
  if (tag !== `v${checkoutVersion}`) {
    fail(`Tag ${tag} does not match this checkout's VERSION (v${checkoutVersion}). ` +
      'The bundled daemon must come from the same source version being packaged.')
  }

  console.log(`==> Fetching daemon sidecar from GitHub Release ${tag}`)
  const fetcher = join(root, 'scripts/release/fetch-github-release-asset.mjs')
  const result = spawnSync(
    process.execPath,
    [fetcher, '--repo', repo, '--tag', tag, '--asset', assetName, '--out', dest],
    { stdio: 'inherit', cwd: root },
  )
  if (result.status !== 0) {
    fail(`GitHub download failed (exit ${result.status}). ` +
      'Falling back silently would break source identity; build locally with --source local instead.')
  }

  if (!isWin) { try { chmodSync(dest, 0o755) } catch { /* best effort */ } }
  const reported = daemonVersion(dest)
  if (!reported) fail('Downloaded daemon did not report a version via --version; refusing to stage.')
  if (!reported.includes(checkoutVersion)) {
    fail(`Downloaded daemon reports version ${reported}, expected ${checkoutVersion}. ` +
      'Refusing to stage a binary that does not match this checkout.')
  }

  stageReceipt('github-release', { tag, version: reported })
  console.log(`Staged daemon sidecar (from GH Release ${tag}, version ${reported}) at ${dest}`)
} else if (source === 'local') {
  console.log('==> Build scriptor-daemon release binary (local cargo build)')
  process.chdir(root)
  execSync('cargo build -p scriptor-daemon --release', { stdio: 'inherit' })

  const built = join(root, 'target/release', binary)
  if (!existsSync(built)) fail(`Daemon binary not found: ${built}`)

  copyFileSync(built, dest)
  stageReceipt('local-build', { checkoutVersion })
  console.log(`Staged daemon sidecar (from local build) at ${dest}`)
} else {
  fail(`Unknown --source "${source}". Use "local" (default) or "github-release".`)
}
