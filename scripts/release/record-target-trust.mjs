#!/usr/bin/env node
import path from 'node:path'

import {
  normalizeReleaseArchitecture,
  normalizeReleaseChannel,
  normalizeReleasePlatform,
  normalizeTrustProfile,
} from './signing-policy.mjs'
import { verifyNativeSigning } from './native-signing.mjs'
import { writeSigningEvidence } from './signing-evidence.mjs'

function readArgument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  if (index === -1) return fallback
  const value = process.argv[index + 1]
  if (!value || value.startsWith('--')) throw new Error(`missing value for --${name}`)
  return value
}

const platform = normalizeReleasePlatform(readArgument('platform', process.env.SCRIPTOR_PLATFORM))
const architecture = normalizeReleaseArchitecture(readArgument('architecture', process.env.SCRIPTOR_ARCHITECTURE))
const channel = normalizeReleaseChannel(readArgument('channel', process.env.SCRIPTOR_RELEASE_CHANNEL ?? 'preview'))
const trustProfile = normalizeTrustProfile(readArgument('trust-profile', process.env.SCRIPTOR_TRUST_PROFILE ?? 'unsigned'))
const bundleRoot = path.resolve(readArgument('bundle-root', 'target/release/bundle'))

const trust = trustProfile === 'native-signed'
  ? verifyNativeSigning({ platform, bundleRoot })
  : {
      signed: false,
      notarized: false,
      signatureType: 'none',
      verifier: 'unsigned artifact; verify SHA-256 and GitHub provenance/SBOM attestations',
    }

const { evidence, outputPath } = writeSigningEvidence(bundleRoot, {
  platform,
  architecture,
  channel,
  ...trust,
})
console.log(
  `Recorded ${trustProfile} trust evidence at ${outputPath}: `
  + `${evidence.platform}/${evidence.architecture} signed=${evidence.signed} notarized=${evidence.notarized}.`,
)
