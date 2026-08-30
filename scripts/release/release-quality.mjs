export const RELEASE_QUALITY_CHECKS = Object.freeze([
  Object.freeze({ id: 'governance', command: ['pnpm', 'check:governance'] }),
  Object.freeze({ id: 'source-contracts', command: ['pnpm', 'check:source'] }),
  Object.freeze({ id: 'contract-typecheck', command: ['pnpm', 'check:contracts'] }),
  Object.freeze({ id: 'mcp-validation', command: ['pnpm', 'check:mcp'] }),
  Object.freeze({ id: 'lint', command: ['pnpm', 'lint'] }),
  Object.freeze({ id: 'build', command: ['pnpm', 'build'] }),
  // The protected release kickoff already verifies a successful exact-commit
  // main CI run, whose Rust suite covers this product test command. Running
  // it again after tagging duplicates that evidence and has repeatedly been
  // canceled by hosted runners before the other source-bound checks can run.
  Object.freeze({ id: 'release-smoke', command: ['pnpm', 'release:smoke'] }),
  Object.freeze({ id: 'accessibility-axe', command: ['pnpm', 'check:a11y-axe'] }),
  Object.freeze({ id: 'e2e', command: ['pnpm', 'test:e2e'] }),
  Object.freeze({ id: 'visual-regression', command: ['pnpm', 'test:visual'] }),
  Object.freeze({
    id: 'performance',
    command: ['node', 'scripts/benchmarks/check-baselines.mjs', '--output=artifacts/release-quality/performance-evidence.json'],
    output: 'performance-evidence.json',
  }),
])

export async function runReleaseQualityChecks({ source, version, createdAt = new Date().toISOString(), execute }) {
  if (!source || source.schemaVersion !== 2 || !source.sourceTreeSha256) {
    throw new Error('release quality requires source identity schema 2')
  }
  if (!String(version ?? '').trim()) throw new Error('release quality requires a version')
  if (typeof execute !== 'function') throw new Error('release quality requires an executor')

  const checks = []
  for (const check of RELEASE_QUALITY_CHECKS) {
    let result
    try {
      result = await execute(check)
    } catch (error) {
      result = {
        status: 'failed',
        durationMs: 0,
        error: error instanceof Error ? error.message : String(error),
      }
    }
    if (!['passed', 'failed'].includes(result?.status)) {
      throw new Error(`invalid release quality status for ${check.id}: ${result?.status ?? '<missing>'}`)
    }
    checks.push({
      id: check.id,
      command: check.command.join(' '),
      status: result.status,
      durationMs: Number.isFinite(result.durationMs) ? Math.max(0, Math.round(result.durationMs)) : 0,
      ...(result.error ? { error: String(result.error).slice(0, 4096) } : {}),
    })
  }

  return {
    schemaVersion: 1,
    createdAt,
    version: String(version).trim(),
    source,
    requiredChecks: RELEASE_QUALITY_CHECKS.map((check) => check.id),
    checks,
    pass: checks.every((check) => check.status === 'passed'),
  }
}
