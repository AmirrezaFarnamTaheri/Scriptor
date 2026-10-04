#!/usr/bin/env node
/**
 * fetch-github-release-asset.mjs
 *
 * Downloads a single asset from a GitHub Release and writes it to disk.
 * Falls back gracefully when GITHUB_TOKEN is absent (public repos).
 *
 * Usage:
 *   node fetch-github-release-asset.mjs \
 *     --repo  AmirrezaFarnamTaheri/Scriptor \
 *     --tag   latest                          \  # or a specific tag e.g. v1.0.0
 *     --asset scriptor-daemon-windows-x86_64.exe \
 *     --out   apps/desktop/src-tauri/binaries/scriptor-daemon.exe
 *
 * Environment:
 *   GITHUB_TOKEN  – optional; set in CI for authenticated requests (higher rate limit)
 *   SCRIPTOR_SKIP_GH_DOWNLOAD – if "true", exits 0 without downloading (useful for local dev)
 */

import { createHash } from 'node:crypto'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { downloadAsset, httpsGet } from './github-asset-transport.mjs'
export { downloadAsset, httpsGet } from './github-asset-transport.mjs'

// ── helpers ───────────────────────────────────────────────────────────────────

function arg(name, fallback) {
  const idx = process.argv.indexOf(`--${name}`)
  if (idx !== -1 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith('--')) {
    return process.argv[idx + 1]
  }
  if (fallback !== undefined) return fallback
  throw new Error(`Required argument --${name} not provided`)
}

/** Fetches JSON from the GitHub API. */
async function fetchJson(url) {
  const headers = { Accept: 'application/vnd.github+json' }
  if (process.env.GITHUB_TOKEN) headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`
  const res = await httpsGet(url, headers)
  if (res.statusCode !== 200) { res.resume(); throw new Error(`GitHub API error ${res.statusCode} for ${url}`) }
  return new Promise((resolve, reject) => {
    const chunks = []
    let bytes = 0
    res.on('data', (chunk) => {
      bytes += chunk.length
      if (bytes > 2 * 1024 * 1024) res.destroy(new Error('Release metadata exceeds the 2 MiB limit'))
      else chunks.push(chunk)
    })
    res.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))) } catch (e) { reject(e) }
    })
    res.on('error', reject)
  })
}

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
const _root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

if (process.env.SCRIPTOR_SKIP_GH_DOWNLOAD === 'true') {
  console.log('SCRIPTOR_SKIP_GH_DOWNLOAD=true — skipping GitHub asset download.')
  process.exit(0)
}

const repo      = arg('repo',  'AmirrezaFarnamTaheri/Scriptor')
const tag       = arg('tag',   'latest')
const assetName = arg('asset')
const outPath   = resolve(_root, arg('out'))
if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) throw new Error('Invalid GitHub owner/repository')

const releaseUrl = tag === 'latest'
  ? `https://api.github.com/repos/${repo}/releases/latest`
  : `https://api.github.com/repos/${repo}/releases/tags/${encodeURIComponent(tag)}`

console.log(`==> Fetching release info: ${releaseUrl}`)
const release = await fetchJson(releaseUrl)
const asset = release.assets?.find((a) => a.name === assetName)

if (!asset) {
  const available = (release.assets ?? []).map((a) => a.name).join(', ') || '(none)'
  throw new Error(
    `Asset "${assetName}" not found in release "${release.tag_name}". Available: ${available}`,
  )
}

if (!Number.isSafeInteger(asset.size) || asset.size <= 0) throw new Error('Invalid release asset size')
if (asset.digest != null && !/^sha256:[a-f0-9]{64}$/i.test(asset.digest)) throw new Error('Invalid release asset digest')
const expectedSha256 = asset.digest?.slice(7).toLowerCase()
// Stream large binaries instead of allocating their entire contents in memory.
async function fileDigest(path) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}
// Size alone cannot distinguish a stale or corrupt binary from the release.
if (expectedSha256 && existsSync(outPath) && statSync(outPath).isFile()
    && statSync(outPath).size === asset.size
    && await fileDigest(outPath) === expectedSha256) {
  console.log(`Asset already present with verified SHA-256 (${asset.size} bytes): ${outPath}`)
  process.exit(0)
}

console.log(`==> Downloading ${assetName} (${(asset.size / 1024 / 1024).toFixed(1)} MB) → ${outPath}`)
await downloadAsset(asset.browser_download_url, outPath, { expectedSize: asset.size, expectedSha256 })
console.log(`Asset saved: ${outPath}`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
