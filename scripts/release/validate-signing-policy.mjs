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
})

console.log(
  `${result.channel} ${result.platform}/${result.architecture} policy verified: `
  + 'release artifacts are unsigned and require checksum plus GitHub attestation verification.',
)
