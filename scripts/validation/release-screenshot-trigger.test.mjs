import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const release = fs.readFileSync(new URL('../../.github/workflows/release.yml', import.meta.url), 'utf8').replaceAll('\r\n', '\n')
const refresh = fs.readFileSync(new URL('../../.github/workflows/refresh-screenshots.yml', import.meta.url), 'utf8')

test('successful production publication dispatches screenshot refresh on the default branch', () => {
  const job = release.split('\n  refresh-documentation-screenshots:\n')[1]?.split(/\n {2}[a-z][\w-]*:\n/)[0]
  assert.ok(job, 'release must explicitly dispatch screenshot refresh')
  assert.match(job, /needs: publish/)
  assert.match(job, /if: inputs\.publish && startsWith\(github\.ref, 'refs\/tags\/v'\)/)
  assert.match(job, /actions: write/)
  assert.match(job, /GH_TOKEN: \$\{\{ github\.token \}\}/)
  assert.match(job, /CAPTURE_BRANCH: \$\{\{ github\.event\.repository\.default_branch \}\}/)
  assert.match(job, /gh workflow run refresh-screenshots\.yml --repo "\$GITHUB_REPOSITORY" --ref "\$CAPTURE_BRANCH" -f allow_default_branch=true/)
  assert.doesNotMatch(job, /always\(\)|continue-on-error/)
})

test('refresh remains branch-only, replaces superseded captures, and refuses non-fast-forward publication', () => {
  assert.match(refresh, /workflow_dispatch:/)
  assert.match(refresh, /startsWith\(github\.ref, 'refs\/heads\/'\)/)
  assert.match(refresh, /group: refresh-screenshots-\$\{\{ github\.ref \}\}/)
  assert.match(refresh, /cancel-in-progress: true/)
  assert.match(refresh, /git push origin "HEAD:refs\/heads\/\$env:CAPTURE_BRANCH"/)
  assert.doesNotMatch(refresh, /--force|git rebase/)
})
