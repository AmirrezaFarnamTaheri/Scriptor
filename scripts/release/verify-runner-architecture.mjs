#!/usr/bin/env node
import os from 'node:os'

import { normalizeReleaseArchitecture } from './signing-policy.mjs'

function readArgument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  if (index === -1) return fallback
  const value = process.argv[index + 1]
  if (!value || value.startsWith('--')) throw new Error(`missing value for --${name}`)
  return value
}

const expected = normalizeReleaseArchitecture(
  readArgument('expected', process.env.SCRIPTOR_ARCHITECTURE),
)
const actual = normalizeReleaseArchitecture(
  readArgument('actual', process.env.SCRIPTOR_RUNNER_ARCHITECTURE ?? os.arch()),
)

if (actual !== expected) {
  throw new Error(`runner architecture mismatch: expected ${expected}, found ${actual}`)
}

console.log(`Runner architecture OK: ${actual}`)
