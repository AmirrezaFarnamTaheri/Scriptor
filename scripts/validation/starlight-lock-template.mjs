#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../..')
const generatedPath = process.argv[2]
assert.ok(generatedPath, 'usage: node scripts/validation/starlight-lock-template.mjs <generated-lock>')

const partsDir = path.join(root, 'crates/publish-runner/src/starlight-lock')
const parts = fs.existsSync(partsDir)
  ? fs.readdirSync(partsDir).filter((name) => /^part-\d{3}\.txt$/.test(name)).sort()
  : []
assert.ok(parts.length > 0, 'checked-in Starlight lock template parts are missing')

const expected = parts.map((name) => fs.readFileSync(path.join(partsDir, name), 'utf8')).join('')
const generated = fs.readFileSync(path.resolve(generatedPath), 'utf8')
assert.equal(expected, generated, 'generated Starlight pnpm-lock.yaml differs from the checked-in template')
console.log(`Starlight lock template OK: ${parts.length} part(s), ${Buffer.byteLength(expected)} bytes.`)
