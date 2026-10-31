import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const guard = fileURLToPath(new URL('../release/kickoff-eligibility.sh', import.meta.url))
const HEAD = 'a'.repeat(40)
const OLD = 'b'.repeat(40)
function run({ event = 'workflow_run', validated = HEAD, tagCommit = '', http = '404', curlExit = '0', token = 'test-token' } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'release-tag-check-'))
  try {
    const bin = join(root, 'bin')
    mkdirSync(bin)
    const output = join(root, 'output')
    writeFileSync(join(root, 'VERSION'), '1.3.3\n')
    writeFileSync(output, '')
    writeFileSync(join(bin, 'git'), '#!/bin/sh\nif [ -n "$MOCK_TAG_COMMIT" ]; then printf "%s\\trefs/tags/v1.3.3\\n" "$MOCK_TAG_COMMIT"; fi\n')
    writeFileSync(join(bin, 'curl'), '#!/bin/sh\nprintf "%s" "$MOCK_HTTP"\nexit "$MOCK_CURL_EXIT"\n')
    for (const name of ['git', 'curl']) chmodSync(join(bin, name), 0o755)
    const r = spawnSync('bash', [guard], {
      cwd: root, encoding: 'utf8',
      env: {
        ...process.env, PATH: [bin, process.env.PATH].join(':'),
        GITHUB_EVENT_NAME: event, GITHUB_SHA: HEAD, SOURCE_SHA: validated,
        GITHUB_OUTPUT: output, GITHUB_REPOSITORY: 'owner/repository',
        GITHUB_API_URL: 'https://api.github.invalid', GH_TOKEN: token,
        MOCK_TAG_COMMIT: tagCommit, MOCK_HTTP: http, MOCK_CURL_EXIT: curlExit,
      },
    })
    return { code: r.status, stdout: r.stdout, stderr: r.stderr, eligible: readFileSync(output, 'utf8').includes('eligible=true') }
  } finally { rmSync(root, { recursive: true, force: true }) }
}

test('new untagged release is eligible', () => {
  const r = run()
  assert.equal(r.code, 0)
  assert.equal(r.eligible, true)
})
test('stale CI head cannot publish', () => {
  const r = run({ validated: OLD })
  assert.equal(r.code, 0)
  assert.equal(r.eligible, false)
  assert.match(r.stdout, /another commit/)
})
test('immutable tag on another commit fails with a version-bump instruction', () => {
  const r = run({ tagCommit: OLD })
  assert.equal(r.code, 1)
  assert.equal(r.eligible, false)
  assert.match(r.stderr, /Immutable version tag conflict/)
  assert.match(r.stderr, /Increment VERSION/)
})
test('unpublished tag on exact commit permits a safe re-dispatch', () => {
  const r = run({ tagCommit: HEAD, http: '404' })
  assert.equal(r.code, 0)
  assert.equal(r.eligible, true)
  assert.match(r.stdout, /retry production dispatch/)
})
test('published same-commit release does not dispatch twice', () => {
  const r = run({ tagCommit: HEAD, http: '200' })
  assert.equal(r.code, 0)
  assert.equal(r.eligible, false)
})
test('HTTP auth errors, server errors and transport failures fail closed', () => {
  for (const status of ['401', '403', '500']) {
    const r = run({ tagCommit: HEAD, http: status })
    assert.equal(r.code, 1, status)
    assert.equal(r.eligible, false, status)
  }
  const transport = run({ tagCommit: HEAD, curlExit: '7' })
  assert.equal(transport.code, 1)
  assert.equal(transport.eligible, false)
})
test('manual dispatch still reaches downstream branch and immutable-tag checks', () => {
  const r = run({ event: 'workflow_dispatch', tagCommit: OLD })
  assert.equal(r.code, 0)
  assert.equal(r.eligible, true)
})
test('workflow invokes the tested guard with a scoped GitHub token', () => {
  const workflow = readFileSync(new URL('../../.github/workflows/release-kickoff.yml', import.meta.url), 'utf8')
  assert.match(workflow, /GH_TOKEN:/)
  assert.match(workflow, /bash scripts\/release\/kickoff-eligibility\.sh/)
  assert.doesNotMatch(workflow, /already tagged; no repeat dispatch/)
})
