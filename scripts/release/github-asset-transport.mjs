import https from 'node:https'
import { createHash, randomUUID } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdir, rename, rm } from 'node:fs/promises'
import { dirname } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Transform } from 'node:stream'

function secureUrl(value, base) {
  const url = new URL(value, base)
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Release downloads require HTTPS without URL credentials')
  return url
}

/** Redirect credentials belong to the original origin, never its asset CDN. */
export async function httpsGet(url, headers = {}, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    const attempt = (currentUrl, remaining, currentHeaders) => {
      try {
        const parsed = secureUrl(currentUrl)
        const request = https.get({
          hostname: parsed.hostname,
          port: parsed.port || undefined,
          path: parsed.pathname + parsed.search,
          headers: { 'User-Agent': 'scriptor-release-tooling/1.0', ...currentHeaders },
        }, res => {
          if (![301, 302, 303, 307, 308].includes(res.statusCode) || !res.headers.location) { resolve(res); return }
          res.resume()
          try {
            if (remaining <= 0) throw new Error('Too many redirects')
            const next = secureUrl(res.headers.location, parsed)
            const nextHeaders = Object.fromEntries(Object.entries(currentHeaders).filter(([key]) =>
              next.origin === parsed.origin || !['authorization', 'cookie', 'proxy-authorization'].includes(key.toLowerCase())))
            attempt(next, remaining - 1, nextHeaders)
          } catch (cause) { reject(cause) }
        })
        request.setTimeout(30_000, () => request.destroy(new Error('Release download timed out')))
        request.on('error', reject)
      } catch (cause) { reject(cause) }
    }
    attempt(url, maxRedirects, headers)
  })
}

/** A failed stream or integrity check cannot replace a previously staged binary. */
export async function downloadAsset(assetUrl, outputPath, { expectedSize, expectedSha256 } = {}) {
  const headers = { Accept: 'application/octet-stream' }
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  const res = await httpsGet(assetUrl, headers)
  if (res.statusCode !== 200) { res.resume(); throw new Error(`Download error ${res.statusCode}`) }
  const temporary = `${outputPath}.${randomUUID()}.partial`
  const hash = createHash('sha256')
  let bytes = 0
  const verify = new Transform({ transform(chunk, _encoding, callback) {
    bytes += chunk.length
    if (expectedSize !== undefined && bytes > expectedSize) { callback(new Error('Release asset exceeds its declared size')); return }
    hash.update(chunk); callback(null, chunk)
  } })
  try {
    await mkdir(dirname(outputPath), { recursive: true })
    await pipeline(res, verify, createWriteStream(temporary, { flags: 'wx', mode: 0o600 }))
    if (expectedSize !== undefined && bytes !== expectedSize) throw new Error('Release asset size mismatch')
    if (expectedSha256 && hash.digest('hex') !== expectedSha256) throw new Error('Release asset SHA-256 mismatch')
    await rename(temporary, outputPath)
  } finally {
    res.destroy()
    await rm(temporary, { force: true })
  }
}
