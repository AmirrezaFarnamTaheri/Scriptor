#!/usr/bin/env node
import { validateSigningEnvironment } from './signing-policy.mjs'

function readArgument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  if (index === -1) return fallback
  const value = process.argv[index + 1]
  if (!value || value.startsWith('--')) throw new Error(`missing value for --${name}`)
  return value
}

const result = validateSigningEnvironment({
  platform: readArgument('platform', process.env.SCRIPTOR_PLATFORM),
  architecture: readArgument('architecture', process.env.SCRIPTOR_ARCHITECTURE),
  channel: readArgument('channel', process.env.SCRIPTOR_RELEASE_CHANNEL ?? 'preview'),
  trustProfile: readArgument('trust-profile', process.env.SCRIPTOR_TRUST_PROFILE ?? 'unsigned'),
  env: process.env,
})

const trustDescription = result.trustProfile === 'unsigned'
  ? 'unsigned; verify SHA-256 plus provenance attestation'
  : `${result.signingMode}; preserve SHA-256 plus provenance attestation`
console.log(
  `${result.channel} ${result.platform}/${result.architecture} trust policy verified: ${trustDescription}.`,
)
