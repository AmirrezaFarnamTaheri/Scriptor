#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../..')
const partsDir = path.join(root, 'crates/publish-runner/src/starlight-lock')
const parts = fs.existsSync(partsDir)
  ? fs.readdirSync(partsDir).filter((name) => /^part-\d{3}\.txt$/.test(name)).sort()
  : []
assert.ok(parts.length > 0, 'checked-in Starlight lock template parts are missing')

const expected = parts.map((name) => fs.readFileSync(path.join(partsDir, name), 'utf8')).join('')

if (process.argv[2] === '--write') {
  const outputPath = process.argv[3]
  assert.ok(outputPath, 'usage: node scripts/validation/starlight-lock-template.mjs --write <lock-path>')
  fs.writeFileSync(path.resolve(outputPath), expected, 'utf8')
  console.log(`Wrote Starlight lock template: ${parts.length} part(s), ${Buffer.byteLength(expected)} bytes.`)
  process.exit(0)
}

const generatedPath = process.argv[2]
assert.ok(generatedPath, 'usage: node scripts/validation/starlight-lock-template.mjs <generated-lock>')
const generated = fs.readFileSync(path.resolve(generatedPath), 'utf8')
assert.equal(expected, generated, 'generated Starlight pnpm-lock.yaml differs from the checked-in template')
console.log(`Starlight lock template OK: ${parts.length} part(s), ${Buffer.byteLength(expected)} bytes.`)
