#!/usr/bin/env node
/** MAT-023 checks evidence completeness only, not absolute performance budgets. */
import fs from 'node:fs'
import path from 'node:path'
import { evaluateScaleEvidence } from './scale-evidence.mjs'

if (process.argv.length !== 3) {
  process.stderr.write('Usage: node scripts/benchmarks/verify-scale-evidence.mjs <matrix.json>\n')
  process.exitCode = 2
} else {
  try {
    const target = path.resolve(process.argv[2])
    const stats = fs.statSync(target)
    if (!stats.isFile() || stats.size > 2 * 1024 * 1024) throw new Error('Scale evidence must be a regular JSON file <= 2 MiB')
    const evidence = JSON.parse(fs.readFileSync(target, 'utf8'))
    const result = evaluateScaleEvidence(evidence)
    process.stdout.write(JSON.stringify(result, null, 2) + '\n')
    process.exitCode = result.readyForReview ? 0 : 1
  } catch (error) {
    process.stderr.write('Invalid MAT-023 scale evidence: ' + (error instanceof Error ? error.message : String(error)) + '\n')
    process.exitCode = 2
  }
}
