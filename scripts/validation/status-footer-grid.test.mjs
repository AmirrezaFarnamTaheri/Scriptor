import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('job-progress.is-done CSS contract prevents 18px wrapping and bounds height', () => {
  const css = readFileSync(
    new URL('../../src/styles/app/workspace-geometry-contract.css', import.meta.url),
    'utf8',
  )

  // Verify .job-progress.is-done does NOT use 2-column grid that isolates 3rd child to 18px track
  assert.equal(
    css.includes('grid-template-columns: 18px auto;'),
    false,
    '.job-progress.is-done must not use 2-column grid-template-columns: 18px auto',
  )

  // Verify single-row flex alignment and bounded height <= 28px
  assert.ok(
    css.includes('display: inline-flex;') && css.includes('max-height: 28px;'),
    '.job-progress.is-done must be inline-flex and bounded to max-height: 28px',
  )

  // Verify .job-progress-text grouping
  assert.ok(
    css.includes('.job-progress-text'),
    '.job-progress.is-done must style .job-progress-text container',
  )
})

test('WorkspaceStatusFooter groups indexReady into single text container and unifies problems badge', () => {
  const tsx = readFileSync(
    new URL('../../src/components/shell/WorkspaceStatusFooter.tsx', import.meta.url),
    'utf8',
  )

  // Index ready text grouping
  assert.ok(
    tsx.includes('<div className="job-progress-text">'),
    'WorkspaceStatusFooter must wrap indexReady and note count inside .job-progress-text',
  )

  // Problem count in jobs-button is shown when problems exist
  assert.ok(
    tsx.includes('totalProblemCount > 0 ? ('),
    'WorkspaceStatusFooter jobs-button must show Problem count text when problems exist',
  )

  // Jobs button has explicit aria-label
  assert.ok(
    tsx.includes('aria-label={totalProblemCount > 0 ?'),
    'WorkspaceStatusFooter jobs-button must declare explicit dynamic aria-label',
  )
})

test('dock-settings.css evenly distributes tabs and collapses empty dock panel', () => {
  const css = readFileSync(
    new URL('../../src/styles/app/dock-settings.css', import.meta.url),
    'utf8',
  )

  // Even tab distribution
  assert.ok(
    css.includes('flex: 1 1 0;'),
    '.bottom-tabs button must use flex: 1 1 0 for balanced tab distribution',
  )

  // Empty dock panel collapse
  assert.ok(
    css.includes('.dock-panel:has(.empty-state)'),
    'dock-settings.css must collapse empty state via .dock-panel:has(.empty-state)',
  )
})
