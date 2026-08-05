import assert from 'node:assert/strict'
import test from 'node:test'

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
