#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { gitWorkspaceFiles, hasDotSegment } from '../lib/workspace-files.mjs'

const root = path.resolve(import.meta.dirname, '../..')
const ignoredDirectories = new Set([
  'node_modules',
  'target',
  'dist',
  'dist-e2e',
  'dist-ssr',
  'dist-visual-e2e',
  'coverage',
  'release-output',
  'release-artifacts',
  'release-artifacts-test',
  'release-evidence',
  'release-manifests-test',
  'test-results',
  'playwright-report',
  'update-manifests',
])
const testPattern = /\.test\.(?:ts|js|mjs)$/

// Legacy filesystem walk for checkouts without git (packaged source drops).
// The git listing is preferred: it honors .gitignore, so ignored build
// output never reaches the suite, while untracked-but-not-ignored new tests
// still run.
function collect(directory, output) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    // Dot-directories hold tool state, caches, and linked git worktrees
    // (e.g. .release-1.0.2), never first-party tests; running their copies
    // duplicates the suite and fails spuriously on worktree-local state.
    if (entry.isDirectory() && (entry.name.startsWith('.') || ignoredDirectories.has(entry.name))) continue
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      collect(absolute, output)
      continue
    }
    if (entry.isFile() && testPattern.test(entry.name)) output.push(absolute)
  }
}

function collectLegacyTests() {
  const output = []
  collect(root, output)
  return output
}

const gitFiles = gitWorkspaceFiles(root)
if (!gitFiles) console.warn('source tests: git unavailable, walking the filesystem')
const tests = (gitFiles ?? collectLegacyTests())
  .filter((file) => testPattern.test(path.basename(file)))
  .filter((file) => !hasDotSegment(file, root))
  .filter((file) => !ignoredDirectories.has(path.relative(root, file).split(path.sep)[0]))
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
