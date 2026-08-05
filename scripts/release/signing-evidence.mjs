import fs from 'node:fs'
import path from 'node:path'

import { normalizeReleaseChannel, normalizeReleasePlatform } from './signing-policy.mjs'

const SIGNATURE_TYPES = new Set(['none', 'authenticode', 'developer-id', 'openpgp'])
const EXPECTED_SIGNATURE_TYPES = {
  windows: 'authenticode',
  macos: 'developer-id',
  linux: 'openpgp',
}

function parseBoolean(value, name) {
  if (value === true || value === 'true') return true
  if (value === false || value === 'false') return false
  throw new Error(`${name} must be true or false`)
}

function createdAtFromEnvironment(env = process.env) {
  const epoch = Number(env.SOURCE_DATE_EPOCH)
  return Number.isFinite(epoch) && epoch >= 0
    ? new Date(epoch * 1000).toISOString()
    : new Date().toISOString()
}

export function createSigningEvidence({
  platform,
  channel,
  signed,
  notarized = false,
  signatureType,
  verifier,
  sourceCommit = process.env.GITHUB_SHA ?? null,
  createdAt = createdAtFromEnvironment(),
}) {
  const normalizedPlatform = normalizeReleasePlatform(platform)
  const normalizedChannel = normalizeReleaseChannel(channel)
  const normalizedSigned = parseBoolean(signed, 'signed')
  const normalizedNotarized = parseBoolean(notarized, 'notarized')
  const normalizedSignatureType = String(signatureType ?? (normalizedSigned ? EXPECTED_SIGNATURE_TYPES[normalizedPlatform] : 'none')).trim()
  if (!SIGNATURE_TYPES.has(normalizedSignatureType)) {
    throw new Error(`unsupported signature type: ${normalizedSignatureType}`)
  }
  if (!String(verifier ?? '').trim()) throw new Error('signing evidence verifier is required')
  if (!normalizedSigned && normalizedSignatureType !== 'none') {
    throw new Error('unsigned evidence must use signatureType none')
  }
  if (normalizedSigned && normalizedSignatureType !== EXPECTED_SIGNATURE_TYPES[normalizedPlatform]) {
    throw new Error(`${normalizedPlatform} signing evidence must use ${EXPECTED_SIGNATURE_TYPES[normalizedPlatform]}`)
  }
  if (normalizedPlatform !== 'macos' && normalizedNotarized) {
    throw new Error('only macOS signing evidence may be notarized')
  }

  return {
    schemaVersion: 1,
    platform: normalizedPlatform,
    channel: normalizedChannel,
    signed: normalizedSigned,
    notarized: normalizedNotarized,
    signatureType: normalizedSignatureType,
    verifier: String(verifier).trim(),
    sourceCommit: sourceCommit ? String(sourceCommit) : null,
    createdAt: String(createdAt),
  }
}

export function signingEvidenceFilename(platform) {
  return `signing-evidence-${normalizeReleasePlatform(platform)}.json`
}

export function writeSigningEvidence(directory, input) {
  const evidence = createSigningEvidence(input)
  fs.mkdirSync(directory, { recursive: true })
  const outputPath = path.join(directory, signingEvidenceFilename(evidence.platform))
  fs.writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`)
  return { evidence, outputPath }
}

export function collectSigningEvidence(subjectDir) {
  const root = path.resolve(subjectDir)
  const found = []

  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name)
      if (entry.isDirectory()) {
        walk(absolute)
      } else if (entry.isFile() && /^signing-evidence-(windows|macos|linux)\.json$/.test(entry.name)) {
        const parsed = JSON.parse(fs.readFileSync(absolute, 'utf8'))
        found.push(createSigningEvidence(parsed))
      }
    }
  }

  walk(root)
  found.sort((left, right) => left.platform.localeCompare(right.platform))
  return found
}

export function assertSigningEvidence(records, { channel = 'production', expectedSourceCommit } = {}) {
  const normalizedChannel = normalizeReleaseChannel(channel)
  const byPlatform = new Map()
  for (const raw of records) {
    const record = createSigningEvidence(raw)
    if (byPlatform.has(record.platform)) {
      throw new Error(`duplicate signing evidence for ${record.platform}`)
    }
    if (record.channel !== normalizedChannel) {
      throw new Error(`signing evidence channel mismatch for ${record.platform}`)
    }
    if (expectedSourceCommit && record.sourceCommit !== expectedSourceCommit) {
      throw new Error(`signing evidence source commit mismatch for ${record.platform}`)
    }
    byPlatform.set(record.platform, record)
  }

  for (const platform of ['windows', 'macos', 'linux']) {
    if (!byPlatform.has(platform)) throw new Error(`missing signing evidence for ${platform}`)
  }

  if (normalizedChannel === 'production') {
    for (const platform of ['windows', 'macos', 'linux']) {
      const record = byPlatform.get(platform)
      if (!record.signed) throw new Error(`production ${platform} artifact is unsigned`)
      if (record.signatureType !== EXPECTED_SIGNATURE_TYPES[platform]) {
        throw new Error(`production ${platform} signature type is invalid`)
      }
    }
    if (!byPlatform.get('macos').notarized) {
      throw new Error('production macOS artifact is not notarized')
    }
  }

  return [...byPlatform.values()].sort((left, right) => left.platform.localeCompare(right.platform))
}
