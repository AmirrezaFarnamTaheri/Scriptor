import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

// A temporary crates.io HTTP/2 framing failure must not block the pinned
// cargo-deny install when Cargo's supported HTTP/1.1 fallback is available.
const workflow = readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8')

test('supply-chain cargo-deny uses HTTP/1.1 and bounded Cargo network retries', () => {
  const start = workflow.indexOf('      - name: Install pinned cargo-deny 0.20.2\n')
  assert.notEqual(start, -1, 'the pinned audit-tool install step exists')
  const end = workflow.indexOf('\n      - name:', start + 1)
  assert.ok(end > start, 'the install step is independent of audit enforcement')
  const step = workflow.slice(start, end)
  assert.match(step, /CARGO_HTTP_MULTIPLEXING: ['"]?false['"]?/,
    'use Cargo HTTP/1.1 for its documented HTTP/2 framing fallback')
  assert.match(step, /CARGO_NET_RETRY: ['"]?5['"]?/,
    'transient download failures have a bounded retry budget')
  assert.match(step, /run: cargo install cargo-deny --locked --version 0\.20\.2 --force/,
    'keep the exact pinned, locked auditor installation')
})

test('the cargo-deny verification remains fail-closed after transport hardening', () => {
  assert.match(workflow, /- name: Audit Rust licenses, bans, advisories, and sources/)
  assert.match(workflow, /- name: Enforce supply-chain audit outcomes/)
  assert.match(workflow, /if \(\$env:CARGO_DENY_OUTCOME -eq "failure"\)/,
    'audit failure must remain an enforcement failure')
})
