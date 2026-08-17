/**
 * validate-palette-score-runner.ts
 * --------------------------------
 * Behavioural coverage for the single fuzzy scorer (F-3, I-5).
 *
 * Run with: pnpm check:palette-score
 */

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { scoreCommand, _internals } from './paletteScore.ts'

const { normalise, initialsMatch, subsequenceScore, keywordBagScore } = _internals

// ── normalise ─────────────────────────────────────────────────────────────────

test('normalise: lower-cases input', () => {
  assert.equal(normalise('Open Vault'), 'open vault')
})

test('normalise: strips combining diacritics', () => {
  assert.equal(normalise('Résumé'), 'resume')
  assert.equal(normalise('naïve'), 'naive')
  assert.equal(normalise('Ångström'), 'angstrom')
})

test('normalise: collapses multiple spaces', () => {
  assert.equal(normalise('open  vault'), 'open vault')
})

// ── subsequenceScore ──────────────────────────────────────────────────────────

test('subsequenceScore: empty query returns 1', () => {
  assert.equal(subsequenceScore('', 'anything'), 1)
})

test('subsequenceScore: returns 0 when not all chars matched', () => {
  assert.equal(subsequenceScore('xyz', 'open vault'), 0)
})

test('subsequenceScore: returns positive for valid subsequence', () => {
  assert.ok(subsequenceScore('ov', 'open vault') > 0)
})

test('subsequenceScore: tighter clusters score higher', () => {
  const tight = subsequenceScore('ov', 'overview')   // o-v adjacent
  const loose = subsequenceScore('ov', 'open vault')  // o..v with gap
  assert.ok(tight > loose, `expected tight(${tight}) > loose(${loose})`)
})

// ── initialsMatch ─────────────────────────────────────────────────────────────

test('initialsMatch: "ov" matches "open vault"', () => {
  assert.ok(initialsMatch('ov', 'open vault'))
})

test('initialsMatch: "ri" matches "rebuild index"', () => {
  assert.ok(initialsMatch('ri', 'rebuild index'))
})

test('initialsMatch: returns false when order wrong', () => {
  assert.ok(!initialsMatch('vo', 'open vault'))
})

// ── keywordBagScore ───────────────────────────────────────────────────────────

test('keywordBagScore: returns 0 when no keyword matches', () => {
  assert.equal(keywordBagScore('xyz', ['open', 'vault', 'settings']), 0)
})

test('keywordBagScore: returns positive for prefix match', () => {
  assert.ok(keywordBagScore('set', ['settings']) > 0)
})

test('keywordBagScore: prefix scores higher than substring', () => {
  const prefix = keywordBagScore('set', ['settings'])
  const sub    = keywordBagScore('ting', ['settings'])
  assert.ok(prefix > sub, `expected prefix(${prefix}) > sub(${sub})`)
})

// ── scoreCommand ──────────────────────────────────────────────────────────────

const commands = [
  { label: 'Open Vault', keywords: ['vault', 'sidebar'] },
  { label: 'Open Settings', keywords: ['preferences', 'config'] },
  { label: 'Rebuild Index', keywords: ['reindex', 'cache'] },
  { label: 'Toggle Inspector', keywords: ['inspector', 'panel'] },
]

test('scoreCommand: empty query returns 1 for all items', () => {
  for (const cmd of commands) {
    assert.equal(scoreCommand('', cmd), 1)
  }
})

test('scoreCommand: exact prefix scores > 100_000', () => {
  const score = scoreCommand('open vault', { label: 'Open Vault' })
  assert.ok(score > 100_000, `score was ${score}`)
})

test('scoreCommand: exact prefix ranks above substring', () => {
  const prefixScore = scoreCommand('open v', { label: 'Open Vault' })
  const subScore    = scoreCommand('open v', { label: 'Reopen Vault' })
  assert.ok(prefixScore > subScore, `prefix(${prefixScore}) should > sub(${subScore})`)
})

test('scoreCommand: subsequence match returns > 0', () => {
  assert.ok(scoreCommand('ov', { label: 'Open Vault' }) > 0)
})

test('scoreCommand: keyword match returns > 0 when label does not match', () => {
  const score = scoreCommand('reindex', { label: 'Rebuild Index', keywords: ['reindex'] })
  assert.ok(score > 0, `score was ${score}`)
})

test('scoreCommand: returns 0 for completely unrelated query', () => {
  assert.equal(scoreCommand('zzz', { label: 'Open Vault' }), 0)
})

test('scoreCommand: diacritic query matches label without diacritics', () => {
  const score = scoreCommand('resume', { label: 'Résumé Tips' })
  assert.ok(score > 0, `score was ${score}`)
})

test('scoreCommand: sorts open-vault and open-settings to the top for "op"', () => {
  const query = 'op'
  const sorted = commands
    .map((cmd) => ({ cmd, score: scoreCommand(query, cmd) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ cmd }) => cmd.label)

  const topTwo = sorted.slice(0, 2)
  assert.ok(topTwo.includes('Open Vault'), `top two: ${topTwo.join(', ')}`)
  assert.ok(topTwo.includes('Open Settings'), `top two: ${topTwo.join(', ')}`)
})
