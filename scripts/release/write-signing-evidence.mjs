#!/usr/bin/env node
import path from 'node:path'

import { writeSigningEvidence } from './signing-evidence.mjs'

function readArgument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  if (index === -1) return fallback
  const value = process.argv[index + 1]
  if (!value || value.startsWith('--')) throw new Error(`missing value for --${name}`)
  return value
}

const directory = path.resolve(readArgument('output-dir', 'target/release/bundle'))
const { evidence, outputPath } = writeSigningEvidence(directory, {
  platform: readArgument('platform', process.env.SCRIPTOR_PLATFORM),
  architecture: readArgument('architecture', process.env.SCRIPTOR_ARCHITECTURE),
  channel: readArgument('channel', process.env.SCRIPTOR_RELEASE_CHANNEL ?? 'preview'),
  signed: readArgument('signed', 'false'),
  notarized: readArgument('notarized', 'false'),
  signatureType: readArgument('signature-type', undefined),
  verifier: readArgument('verifier', 'not applicable'),
})
console.log(
  `Wrote ${outputPath}: ${evidence.platform}/${evidence.architecture} `
  + `signed=${evidence.signed} notarized=${evidence.notarized}`,
)
