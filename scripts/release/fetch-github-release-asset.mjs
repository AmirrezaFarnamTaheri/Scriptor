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
 *     --tag   latest                          \  # or a specific tag e.g. v0.1.1
 *     --asset scriptor-daemon-windows-x86_64.exe \
 *     --out   apps/desktop/src-tauri/binaries/scriptor-daemon.exe
 *
 * Environment:
 *   GITHUB_TOKEN  – optional; set in CI for authenticated requests (higher rate limit)
 *   SCRIPTOR_SKIP_GH_DOWNLOAD – if "true", exits 0 without downloading (useful for local dev)
 */

import { createWriteStream, mkdirSync, existsSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pipeline } from 'node:stream/promises'
import https from 'node:https'

// ── helpers ───────────────────────────────────────────────────────────────────

function arg(name, fallback) {
  const idx = process.argv.indexOf(`--${name}`)
  if (idx !== -1 && process.argv[idx + 1] && !process.argv[idx + 1].startsWith('--')) {
    return process.argv[idx + 1]
  }
  if (fallback !== undefined) return fallback
  throw new Error(`Required argument --${name} not provided`)
}

/** Performs a single HTTPS GET, following up to maxRedirects 30x redirects. */
async function httpsGet(url, headers = {}, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    const attempt = (currentUrl, remaining) => {
      const parsed = new URL(currentUrl)
      const options = {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        headers: {
          'User-Agent': 'scriptor-release-tooling/1.0',
          ...headers,
        },
      }
      https.get(options, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          if (remaining <= 0) return reject(new Error('Too many redirects'))
          attempt(res.headers.location, remaining - 1)
        } else {
          resolve(res)
        }
      }).on('error', reject)
    }
    attempt(url, maxRedirects)
  })
}

/** Fetches JSON from the GitHub API. */
async function fetchJson(url) {
  const headers = { Accept: 'application/vnd.github+json' }
  if (process.env.GITHUB_TOKEN) headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`
  const res = await httpsGet(url, headers)
  if (res.statusCode !== 200) throw new Error(`GitHub API error ${res.statusCode} for ${url}`)
  return new Promise((resolve, reject) => {
    let body = ''
    res.on('data', (chunk) => (body += chunk))
    res.on('end', () => {
      try { resolve(JSON.parse(body)) } catch (e) { reject(e) }
    })
    res.on('error', reject)
  })
}

/** Downloads a binary asset URL to disk, streaming to avoid memory issues. */
async function downloadAsset(assetUrl, outputPath) {
  const headers = { Accept: 'application/octet-stream' }
  if (process.env.GITHUB_TOKEN) headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`

  // GitHub asset redirects to S3; follow the redirect then stream the body.
  const res = await httpsGet(assetUrl, headers)
  if (res.statusCode !== 200) throw new Error(`Download error ${res.statusCode} from ${assetUrl}`)

  mkdirSync(dirname(outputPath), { recursive: true })
  const writer = createWriteStream(outputPath)
  await pipeline(res, writer)
}

// ── main ─────────────────────────────────────────────────────────────────────

const _root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

if (process.env.SCRIPTOR_SKIP_GH_DOWNLOAD === 'true') {
  console.log('SCRIPTOR_SKIP_GH_DOWNLOAD=true — skipping GitHub asset download.')
  process.exit(0)
}

const repo      = arg('repo',  'AmirrezaFarnamTaheri/Scriptor')
const tag       = arg('tag',   'latest')
const assetName = arg('asset')
const outPath   = resolve(_root, arg('out'))

const releaseUrl = tag === 'latest'
  ? `https://api.github.com/repos/${repo}/releases/latest`
  : `https://api.github.com/repos/${repo}/releases/tags/${tag}`

console.log(`==> Fetching release info: ${releaseUrl}`)
const release = await fetchJson(releaseUrl)
const asset = release.assets?.find((a) => a.name === assetName)

if (!asset) {
  const available = (release.assets ?? []).map((a) => a.name).join(', ') || '(none)'
  throw new Error(
    `Asset "${assetName}" not found in release "${release.tag_name}". Available: ${available}`,
  )
}

// Skip download if the file already exists with the correct size (idempotent).
if (existsSync(outPath) && statSync(outPath).size === asset.size) {
  console.log(`Asset already present and correct size (${asset.size} bytes): ${outPath}`)
  process.exit(0)
}

console.log(`==> Downloading ${assetName} (${(asset.size / 1024 / 1024).toFixed(1)} MB) → ${outPath}`)
await downloadAsset(asset.browser_download_url, outPath)
console.log(`Asset saved: ${outPath}`)
