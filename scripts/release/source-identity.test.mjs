import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import test from 'node:test'
import { getSourceIdentity } from './source-identity.mjs'

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
}

function createRepository() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scriptor-source-identity-'))
  git(root, ['init', '-q'])
  git(root, ['config', 'user.name', 'Source Identity Test'])
  git(root, ['config', 'user.email', 'source-identity@invalid.local'])
  fs.writeFileSync(path.join(root, '.gitattributes'), '* text=auto\n')
  fs.writeFileSync(path.join(root, 'normalized.txt'), 'first\r\nsecond\r\n')
  fs.writeFileSync(path.join(root, 'large.bin'), Buffer.alloc(1_200_000, 0x5a))
  git(root, ['add', '-A'])
  git(root, ['commit', '-qm', 'fixture'])
  return root
}

test('Git source identity hashes canonical blobs across line-ending-normalized worktrees', () => {
  const root = createRepository()
  try {
    const before = getSourceIdentity({ root, requireGit: true, requireClean: true })
    fs.writeFileSync(path.join(root, 'normalized.txt'), 'first\nsecond\n')
    assert.doesNotThrow(() => git(root, ['diff', '--quiet']))
    const after = getSourceIdentity({ root, requireGit: true, requireClean: true })
    assert.equal(after.schemaVersion, 2)
    assert.equal(after.sourceTreeSha256, before.sourceTreeSha256)
    assert.equal(after.sourceFileCount, before.sourceFileCount)
    assert.ok(after.sourceBytes > 1_200_000)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('clean release identity rejects source changes before hashing committed blobs', () => {
  const root = createRepository()
  try {
    fs.writeFileSync(path.join(root, 'normalized.txt'), 'different\n')
    assert.throws(
      () => getSourceIdentity({ root, requireGit: true, requireClean: true }),
      /uncommitted or untracked changes/,
    )
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})
