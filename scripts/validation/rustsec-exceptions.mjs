#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const ADVISORY_PATTERN = /^RUSTSEC-\d{4}-\d{4}$/

export function parseIgnoredAdvisories(source) {
  const match = source.match(/\bignore\s*=\s*\[([\s\S]*?)\]/)
  if (!match) throw new Error('deny.toml is missing [advisories].ignore')
  return new Set([...match[1].matchAll(/"(RUSTSEC-\d{4}-\d{4})"/g)].map((entry) => entry[1]))
}

export function parseLedger(source) {
  const rows = new Map()
  for (const line of source.split(/\r?\n/)) {
    if (!line.startsWith('| RUSTSEC-')) continue
    const columns = line.split('|').slice(1, -1).map((value) => value.trim())
    if (columns.length !== 7) throw new Error(`invalid advisory ledger row: ${line}`)
    const [advisory, dependency, reachability, owner, upstream, reviewBy, exitCondition] = columns
    if (!ADVISORY_PATTERN.test(advisory)) throw new Error(`invalid advisory id: ${advisory}`)
    if (rows.has(advisory)) throw new Error(`duplicate advisory ledger row: ${advisory}`)
    rows.set(advisory, { dependency, reachability, owner, upstream, reviewBy, exitCondition })
  }
  return rows
}

export function validateRustSecExceptions({ denySource, ledgerSource, asOf }) {
  const ignored = parseIgnoredAdvisories(denySource)
  const ledger = parseLedger(ledgerSource)
  const failures = []
  const asOfDate = new Date(`${asOf}T00:00:00Z`)
  if (Number.isNaN(asOfDate.valueOf())) throw new Error(`invalid review date: ${asOf}`)

  for (const advisory of ignored) {
    const row = ledger.get(advisory)
    if (!row) {
      failures.push(`${advisory}: missing ledger row`)
      continue
    }
    for (const field of ['dependency', 'reachability', 'owner', 'upstream', 'exitCondition']) {
      if (!row[field]) failures.push(`${advisory}: ${field} is empty`)
    }
    if (!row.upstream.includes(advisory)) failures.push(`${advisory}: upstream link does not identify advisory`)
    const reviewDate = new Date(`${row.reviewBy}T00:00:00Z`)
    if (Number.isNaN(reviewDate.valueOf())) {
      failures.push(`${advisory}: invalid Review by date ${row.reviewBy}`)
    } else if (reviewDate < asOfDate) {
      failures.push(`${advisory}: review expired on ${row.reviewBy}`)
    }
  }
  for (const advisory of ledger.keys()) {
    if (!ignored.has(advisory)) failures.push(`${advisory}: ledger row has no matching deny.toml ignore`)
  }
  return { ignored, ledger, failures }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const asOf = process.env.SCRIPTOR_SECURITY_REVIEW_AS_OF ?? new Date().toISOString().slice(0, 10)
  const result = validateRustSecExceptions({
    denySource: fs.readFileSync(path.join(ROOT, 'deny.toml'), 'utf8'),
    ledgerSource: fs.readFileSync(path.join(ROOT, 'docs/security/RUSTSEC-EXCEPTIONS.md'), 'utf8'),
    asOf,
  })
  if (result.failures.length) {
    console.error('RustSec exception ledger failed:')
    for (const failure of result.failures) console.error(`- ${failure}`)
    process.exit(1)
  }
  console.log(`RustSec exception ledger OK: ${result.ignored.size} owned exception(s), current as of ${asOf}.`)
}
