import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'

console.log('--- Starting Git Merge Reproduction & Integrity Harness ---')

function git(dir, args) {
  return execFileSync('git', args, {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function tryGit(dir, args) {
  try {
    const stdout = execFileSync('git', args, {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return { ok: true, stdout: stdout.trim() }
  } catch (err) {
    return {
      ok: false,
      code: err.status,
      stderr: (err.stderr || '').toString().trim(),
      stdout: (err.stdout || '').toString().trim(),
    }
  }
}

function initTestRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'scriptor-git-merge-test-'))
  git(dir, ['init', '-b', 'main'])
  git(dir, ['config', 'user.name', 'Scriptor Test'])
  git(dir, ['config', 'user.email', 'test@scriptor.internal'])
  return dir
}

function cleanup(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true })
  } catch {
    // Ignore cleanup errors on Windows
  }
}

// ── Test 1: Fast-forward merge maintains linear history ──
{
  const dir = initTestRepo()
  try {
    fs.writeFileSync(path.join(dir, 'initial.md'), '# Initial\n')
    git(dir, ['add', '.'])
    git(dir, ['commit', '-m', 'initial'])
    const initialHash = git(dir, ['rev-parse', 'HEAD'])

    git(dir, ['checkout', '-b', 'feature'])
    fs.writeFileSync(path.join(dir, 'feature.md'), '# Feature\n')
    git(dir, ['add', '.'])
    git(dir, ['commit', '-m', 'feature work'])
    const featureHash = git(dir, ['rev-parse', 'HEAD'])

    git(dir, ['checkout', 'main'])
    const mergeRes = tryGit(dir, ['merge', '--ff-only', 'feature'])
    assert.equal(mergeRes.ok, true, 'Fast forward merge should succeed')
    assert.equal(git(dir, ['rev-parse', 'HEAD']), featureHash, 'HEAD should point to feature commit')

    const parents = git(dir, ['log', '-1', '--format=%P'])
    assert.equal(parents, initialHash, 'Fast-forward commit has single parent')
    console.log('✓ Fast-forward merge verified')
  } finally {
    cleanup(dir)
  }
}

// ── Test 2: Standard 3-way merge commit has exactly two parents ──
{
  const dir = initTestRepo()
  try {
    fs.writeFileSync(path.join(dir, 'base.md'), '# Base\n')
    git(dir, ['add', '.'])
    git(dir, ['commit', '-m', 'base'])

    git(dir, ['checkout', '-b', 'topic'])
    fs.writeFileSync(path.join(dir, 'topic.md'), '# Topic\n')
    git(dir, ['add', '.'])
    git(dir, ['commit', '-m', 'topic commit'])
    const topicCommit = git(dir, ['rev-parse', 'HEAD'])

    git(dir, ['checkout', 'main'])
    fs.writeFileSync(path.join(dir, 'main.md'), '# Main\n')
    git(dir, ['add', '.'])
    git(dir, ['commit', '-m', 'main commit'])
    const mainCommit = git(dir, ['rev-parse', 'HEAD'])

    git(dir, ['merge', '--no-ff', '-m', 'Merge topic', 'topic'])
    const mergeCommit = git(dir, ['rev-parse', 'HEAD'])

    const parents = git(dir, ['log', '-1', '--format=%P']).split(/\s+/)
    assert.equal(parents.length, 2, 'Merge commit must have exactly two parents')
    assert.equal(parents[0], mainCommit, 'First parent must be HEAD (main)')
    assert.equal(parents[1], topicCommit, 'Second parent must be topic commit')

    // Verify diff-tree on merge commit with -m
    const diffFiles = git(dir, ['diff-tree', '--no-commit-id', '--name-only', '-r', '--root', '-m', mergeCommit])
    assert.ok(diffFiles.includes('topic.md'), 'diff-tree -m must reveal topic.md from merged parent')

    console.log('✓ Standard 3-way merge graph and parents verified')
  } finally {
    cleanup(dir)
  }
}

// ── Test 3: Conflict state: MERGE_HEAD exists, partial commit forbidden ──
{
  const dir = initTestRepo()
  try {
    fs.writeFileSync(path.join(dir, 'doc.md'), '# Base Document\n\nShared content.\n')
    fs.writeFileSync(path.join(dir, 'other.md'), '# Other Document\n')
    git(dir, ['add', '.'])
    git(dir, ['commit', '-m', 'base'])

    git(dir, ['checkout', '-b', 'side'])
    fs.writeFileSync(path.join(dir, 'doc.md'), '# Base Document\n\nSide branch edit.\n')
    fs.writeFileSync(path.join(dir, 'other.md'), '# Other Document\nSide edit.\n')
    git(dir, ['add', '.'])
    git(dir, ['commit', '-m', 'side commit'])
    const sideCommit = git(dir, ['rev-parse', 'HEAD'])

    git(dir, ['checkout', 'main'])
    fs.writeFileSync(path.join(dir, 'doc.md'), '# Base Document\n\nMain branch edit.\n')
    fs.writeFileSync(path.join(dir, 'other.md'), '# Other Document\nMain edit.\n')
    git(dir, ['add', '.'])
    git(dir, ['commit', '-m', 'main commit'])

    const mergeAttempt = tryGit(dir, ['merge', 'side'])
    assert.equal(mergeAttempt.ok, false, 'Merge with conflicting edits must fail')

    // MERGE_HEAD must exist
    const mergeHeadFile = git(dir, ['rev-parse', '--git-path', 'MERGE_HEAD'])
    const mergeHeadPath = path.isAbsolute(mergeHeadFile) ? mergeHeadFile : path.join(dir, mergeHeadFile)
    assert.ok(fs.existsSync(mergeHeadPath), 'MERGE_HEAD must exist on disk during unresolved merge')
    assert.equal(fs.readFileSync(mergeHeadPath, 'utf8').trim(), sideCommit)

    // In standard Git, partial commit during merge is strictly rejected:
    const partialCommit = tryGit(dir, ['commit', 'doc.md', '-m', 'partial'])
    assert.equal(partialCommit.ok, false, 'Git CLI must reject partial commit during merge')
    assert.ok(
      partialCommit.stderr.includes('cannot do a partial commit during a merge') ||
      partialCommit.stderr.includes('partial commit'),
      'Stderr must state partial commit forbidden'
    )

    console.log('✓ Git conflict state: MERGE_HEAD verification and partial commit rejection verified')
  } finally {
    cleanup(dir)
  }
}

console.log('--- All Git Merge Reproduction Harness Checks PASSED ---')
