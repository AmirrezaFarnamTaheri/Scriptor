import fs from 'node:fs'
import path from 'node:path'

import {
  normalizeReleaseArchitecture,
  normalizeReleaseChannel,
  normalizeReleasePlatform,
} from './signing-policy.mjs'

const SIGNATURE_TYPES = new Set(['none', 'authenticode', 'developer-id', 'openpgp'])
const EXPECTED_SIGNATURE_TYPES = {
  windows: 'authenticode',
  macos: 'developer-id',
  linux: 'openpgp',
}

export const DEFAULT_RELEASE_TARGETS = Object.freeze([
  Object.freeze({ platform: 'windows', architecture: 'x86_64' }),
  Object.freeze({ platform: 'macos', architecture: 'aarch64' }),
  Object.freeze({ platform: 'linux', architecture: 'x86_64' }),
  Object.freeze({ platform: 'linux', architecture: 'aarch64' }),
])

function targetKey({ platform, architecture }) {
  return `${platform}/${architecture}`
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

function normalizeTarget(input) {
  return {
    platform: normalizeReleasePlatform(input?.platform),
    architecture: normalizeReleaseArchitecture(input?.architecture),
  }
}

export function createSigningEvidence({
  schemaVersion = 2,
  platform,
  architecture,
  channel,
  signed,
  notarized = false,
  signatureType,
  verifier,
  sourceCommit = process.env.GITHUB_SHA ?? null,
  createdAt = createdAtFromEnvironment(),
}) {
  if (schemaVersion !== 2) throw new Error(`unsupported signing evidence schema: ${schemaVersion}`)
  const normalizedPlatform = normalizeReleasePlatform(platform)
  const normalizedArchitecture = normalizeReleaseArchitecture(architecture)
  const normalizedChannel = normalizeReleaseChannel(channel)
  const normalizedSigned = parseBoolean(signed, 'signed')
  const normalizedNotarized = parseBoolean(notarized, 'notarized')
  const normalizedSignatureType = String(
    signatureType ?? (normalizedSigned ? EXPECTED_SIGNATURE_TYPES[normalizedPlatform] : 'none'),
  ).trim()
  if (!SIGNATURE_TYPES.has(normalizedSignatureType)) {
    throw new Error(`unsupported signature type: ${normalizedSignatureType}`)
  }
  if (!String(verifier ?? '').trim()) throw new Error('signing evidence verifier is required')
  if (!normalizedSigned && normalizedSignatureType !== 'none') {
    throw new Error('unsigned evidence must use signatureType none')
  }
  if (!normalizedSigned && normalizedNotarized) {
    throw new Error('unsigned evidence cannot be notarized')
  }
  if (normalizedSigned && normalizedSignatureType !== EXPECTED_SIGNATURE_TYPES[normalizedPlatform]) {
    throw new Error(`${normalizedPlatform} signing evidence must use ${EXPECTED_SIGNATURE_TYPES[normalizedPlatform]}`)
  }
  if (normalizedPlatform !== 'macos' && normalizedNotarized) {
    throw new Error('only macOS signing evidence may be notarized')
  }

  return {
    schemaVersion: 2,
    platform: normalizedPlatform,
    architecture: normalizedArchitecture,
    channel: normalizedChannel,
    signed: normalizedSigned,
    notarized: normalizedNotarized,
    signatureType: normalizedSignatureType,
    verifier: String(verifier).trim(),
    sourceCommit: sourceCommit ? String(sourceCommit) : null,
    createdAt: String(createdAt),
  }
}

export function signingEvidenceFilename(platform, architecture) {
  return `signing-evidence-${normalizeReleasePlatform(platform)}-${normalizeReleaseArchitecture(architecture)}.json`
}

export function writeSigningEvidence(directory, input) {
  const evidence = createSigningEvidence(input)
  fs.mkdirSync(directory, { recursive: true })
  const outputPath = path.join(
    directory,
    signingEvidenceFilename(evidence.platform, evidence.architecture),
  )
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
      } else if (
        entry.isFile()
        && /^signing-evidence-(windows|macos|linux)-(x86_64|aarch64)\.json$/.test(entry.name)
      ) {
        found.push(createSigningEvidence(JSON.parse(fs.readFileSync(absolute, 'utf8'))))
      }
    }
  }

  walk(root)
  found.sort((left, right) => targetKey(left).localeCompare(targetKey(right)))
  return found
}

export function assertSigningEvidence(
  records,
  {
    channel = 'production',
    expectedSourceCommit,
    expectedTargets = DEFAULT_RELEASE_TARGETS,
  } = {},
) {
  const normalizedChannel = normalizeReleaseChannel(channel)
  const targets = expectedTargets.map(normalizeTarget)
  const expectedKeys = new Set(targets.map(targetKey))
  const byTarget = new Map()

  for (const raw of records) {
    const record = createSigningEvidence(raw)
    const key = targetKey(record)
    if (byTarget.has(key)) throw new Error(`duplicate signing evidence for ${key}`)
    if (!expectedKeys.has(key)) throw new Error(`unexpected signing evidence for ${key}`)
    if (record.channel !== normalizedChannel) {
      throw new Error(`signing evidence channel mismatch for ${key}`)
    }
    if (expectedSourceCommit && record.sourceCommit !== expectedSourceCommit) {
      throw new Error(`signing evidence source commit mismatch for ${key}`)
    }
    if (record.signed && record.signatureType !== EXPECTED_SIGNATURE_TYPES[record.platform]) {
      throw new Error(`${key} signature type is invalid`)
    }
    if (
      normalizedChannel === 'production'
      && record.platform === 'macos'
      && record.signed
      && !record.notarized
    ) {
      throw new Error('signed production macOS artifact is not notarized')
    }
    byTarget.set(key, record)
  }

  for (const target of targets) {
    const key = targetKey(target)
    if (!byTarget.has(key)) throw new Error(`missing signing evidence for ${key}`)
  }

  return [...byTarget.values()].sort((left, right) => targetKey(left).localeCompare(targetKey(right)))
}
