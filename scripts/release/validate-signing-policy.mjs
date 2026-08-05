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
  channel: readArgument('channel', process.env.SCRIPTOR_RELEASE_CHANNEL ?? 'preview'),
})

console.log(
  result.channel === 'production'
    ? `Production signing inputs verified for ${result.platform}.`
    : `Preview release policy verified for ${result.platform}; unsigned artifacts are permitted and are not auto-published.`,
)
