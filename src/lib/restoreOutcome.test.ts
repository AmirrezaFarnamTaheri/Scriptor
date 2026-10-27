import assert from 'node:assert/strict'
import { test } from 'node:test'
import { classifyVaultRestoreStatus } from './restoreOutcome.ts'

test('rolled-back restore is the only outcome that can resume the old draft', () => {
  assert.deepEqual(classifyVaultRestoreStatus('rolled-back'), {
    filesChanged: false, resumeOldDraft: true, refreshWorkspace: false, needsReopen: false,
  })
})

test('a committed restore never resumes the old draft, even when reopen fails', () => {
  assert.deepEqual(classifyVaultRestoreStatus('committed-ready'), {
    filesChanged: true, resumeOldDraft: false, refreshWorkspace: true, needsReopen: false,
  })
  assert.deepEqual(classifyVaultRestoreStatus('committed-needs-reopen'), {
    filesChanged: true, resumeOldDraft: false, refreshWorkspace: false, needsReopen: true,
  })
})

test('an unfinished recovery retains frozen persistence and requires reopen', () => {
  assert.deepEqual(classifyVaultRestoreStatus('recovery-required'), {
    filesChanged: true, resumeOldDraft: false, refreshWorkspace: false, needsReopen: true,
  })
})
