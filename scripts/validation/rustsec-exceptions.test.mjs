import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

import { validateRustSecExceptions } from './rustsec-exceptions.mjs'

const denySource = `[advisories]\nignore = ["RUSTSEC-2026-0001"]\n`
const ledger = (reviewBy) => `| Advisory | Dependency family | Reachability | Owner | Upstream | Review by | Exit condition |\n|---|---|---|---|---|---|---|\n| RUSTSEC-2026-0001 | parser | document import | Security | https://rustsec.org/advisories/RUSTSEC-2026-0001.html | ${reviewBy} | upgrade parser |\n`

test('accepts an owned current exception', () => {
  const result = validateRustSecExceptions({ denySource, ledgerSource: ledger('2026-09-01'), asOf: '2026-08-05' })
  assert.deepEqual(result.failures, [])
})

test('rejects an expired exception', () => {
  const result = validateRustSecExceptions({ denySource, ledgerSource: ledger('2026-08-04'), asOf: '2026-08-05' })
  assert.match(result.failures.join('\n'), /review expired/)
})

test('rejects an ignored advisory without a ledger owner', () => {
  const result = validateRustSecExceptions({ denySource, ledgerSource: '', asOf: '2026-08-05' })
  assert.match(result.failures.join('\n'), /missing ledger row/)
})

test('rejects a rolled-over exception review date', () => {
  const result = validateRustSecExceptions({
    denySource,
    ledgerSource: ledger('2026-09-31'),
    asOf: '2026-08-05',
  })
  assert.match(result.failures.join('\n'), /invalid Review by date 2026-09-31/)
})

test('rejects malformed and rolled-over as-of dates', () => {
  for (const asOf of ['2026-8-05', '2026-02-29']) {
    assert.throws(
      () => validateRustSecExceptions({ denySource, ledgerSource: ledger('2026-09-01'), asOf }),
      new RegExp(`invalid review date: ${asOf}`),
    )
  }
})

test('the HTML sanitizer uses the fixed RustSec release and new maintenance notices stay owned', () => {
  const root = new URL('../../', import.meta.url)
  const lock = readFileSync(new URL('Cargo.lock', root), 'utf8')
  const deny = readFileSync(new URL('deny.toml', root), 'utf8')
  const notes = readFileSync(new URL('docs/security/RUSTSEC-EXCEPTIONS.md', root), 'utf8')
  const ammonia = lock.match(/\[\[package\]\]\s*name = "ammonia"\s*version = "([0-9.]+)"/)
  assert.ok(ammonia, 'ammonia missing from Cargo.lock')
  assert.ok(ammonia[1] === '4.2.4' || /^4\.[3-9]\./.test(ammonia[1]), 'ammonia must stay at or above security-patched 4.2.4')
  assert.doesNotMatch(deny, /"RUSTSEC-2026-0373"/, 'security vulnerability may not be excepted')
  for (const advisory of ['RUSTSEC-2026-0370', 'RUSTSEC-2026-0371', 'RUSTSEC-2026-0372']) {
    assert.ok(deny.includes(`"${advisory}"`), `${advisory} must be enumerated`)
    assert.ok(notes.includes(`| ${advisory} |`), `${advisory} must have a security owner and expiry`)
  }
})
