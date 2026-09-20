import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

function read(name) {
  return fs.readFileSync(new URL(`../../.github/workflows/${name}`, import.meta.url), 'utf8').replaceAll('\r\n', '\n')
}

const ci = read('ci.yml')
const desktop = read('desktop-check.yml')
const docs = read('docs-localization.yml')
const starlight = read('starlight-lock.yml')
const visual = read('visual-review.yml')
const refresh = read('refresh-screenshots.yml')
const publishVault = read('publish-vault.yml')
const kickoff = read('release-kickoff.yml')
const perf = read('perf-trends.yml')

test('PR validation cancels obsolete heads but protected-branch pushes run to completion', () => {
  for (const [name, workflow] of [
    ['CI', ci],
    ['Desktop compile', desktop],
    ['Documentation localization', docs],
    ['Starlight lock', starlight],
    ['Visual review', visual],
  ]) {
    assert.match(
      workflow,
      /cancel-in-progress:\s*\$\{\{ github\.event_name == 'pull_request' \}\}/,
      `${name} must cancel only stale pull-request runs`,
    )
  }
})

test('visual review checks out the immutable PR head and falls back to push SHA', () => {
  assert.match(visual, /ref:\s*\$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/)
  assert.match(visual, /^\s*push:\s*$/m)
})

test('write-back and publication side effects are never cancelled mid-flight', () => {
  assert.match(refresh, /group:\s*refresh-screenshots-\$\{\{ github\.ref \}\}[\s\S]*cancel-in-progress:\s*false/)
  assert.match(publishVault, /cancel-in-progress:\s*false/)
  assert.match(kickoff, /group:\s*release-kickoff-publish[\s\S]*cancel-in-progress:\s*false/)
})


test('performance trends select the intended fixture without expression injection', () => {
  assert.match(perf, /type:\s*choice[\s\S]*- "1k"[\s\S]*- "5k"[\s\S]*- "25k"/)
  assert.match(perf, /PERF_SCHEDULE:\s*\$\{\{ github\.event\.schedule \|\| '' \}\}/)
  assert.match(perf, /REQUESTED_SIZE:\s*\$\{\{ inputs\.size \|\| '5k' \}\}/)
  assert.match(perf, /\$env:PERF_SCHEDULE -eq '0 4 \* \* 6'\) \{ '25k' \}/)
  assert.doesNotMatch(perf, /GITHUB_EVENT_SCHEDULE/)
  assert.doesNotMatch(perf, /'\$\{\{ github\.event\.inputs\.size \}\}'/)
  assert.match(perf, /\$size -notin @\('1k', '5k', '25k'\)/)
})
