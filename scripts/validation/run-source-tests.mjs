#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../..')
const ignoredDirectories = new Set([
  '.git',
  'node_modules',
  'target',
  'dist',
  'release-output',
  'test-results',
  'playwright-report',
])
const testPattern = /\.test\.(?:ts|js|mjs)$/

function collect(directory, output) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      collect(absolute, output)
      continue
    }
    if (entry.isFile() && testPattern.test(entry.name)) output.push(absolute)
  }
}

const tests = []
collect(root, tests)
tests.sort()
if (tests.length === 0) {
  console.error('source tests: no test files discovered')
  process.exit(1)
}

const relative = tests.map((file) => path.relative(root, file))
console.log(`Source test inventory: ${relative.length} files`)
for (const file of relative) console.log(`  - ${file}`)

const result = spawnSync(
  process.execPath,
  ['--experimental-strip-types', '--test', ...relative],
  { cwd: root, stdio: 'inherit', env: process.env },
)
if (result.error) throw result.error
process.exit(result.status ?? 1)
