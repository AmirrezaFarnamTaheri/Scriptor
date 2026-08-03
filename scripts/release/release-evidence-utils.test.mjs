import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  assertExactSubjectSet,
  collectSubjectFiles,
  isPathInside,
  parseSha256Sums,
} from './release-evidence-utils.mjs'

function temporaryDirectory() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'scriptor-release-evidence-'))
}

test('path containment compares path segments instead of string prefixes', () => {
  const root = path.resolve('/tmp/release-evidence')
  assert.equal(isPathInside(root, path.join(root, 'nested', 'file')), true)
  assert.equal(isPathInside(root, path.resolve('/tmp/release-evidence-old/file')), false)
})

test('subject collection excludes only the configured evidence subtree', () => {
  const root = temporaryDirectory()
  const evidence = path.join(root, 'release-evidence')
  fs.mkdirSync(evidence)
  fs.writeFileSync(path.join(root, 'artifact.bin'), 'artifact')
  fs.writeFileSync(path.join(root, 'release-evidence-old.bin'), 'keep')
  fs.writeFileSync(path.join(evidence, 'receipt.json'), 'exclude')

  const files = collectSubjectFiles(root, { excludedDirectory: evidence })
  assert.deepEqual(files.map((item) => item.path), ['artifact.bin', 'release-evidence-old.bin'])
})

test('exact subject validation rejects unreceipted artifacts', () => {
  const expected = [{ path: 'artifact.bin', bytes: 8, sha256: 'a'.repeat(64) }]
  const actual = [
    ...expected,
    { path: 'unexpected.bin', bytes: 1, sha256: 'b'.repeat(64) },
  ]
  assert.throws(() => assertExactSubjectSet(expected, actual), /unreceipted: unexpected\.bin/)
})

test('SHA256SUMS parser rejects duplicates and traversal paths', () => {
  const hash = 'a'.repeat(64)
  assert.throws(() => parseSha256Sums(`${hash}  file\n${hash}  file\n`), /duplicate/)
  assert.throws(() => parseSha256Sums(`${hash}  ../file\n`), /unsafe/)
})
