/** MAT-009: never promote limited candidate slices to exact full-vault results. */
export interface DatabaseQueryCoverageInput {
  readonly candidatesReported: number
  readonly candidatesExamined: number
  readonly loaded: number
  readonly skipped: number
  /** True only for a source-verified full-vault indexed result, not an array length. */
  readonly sourceCoverage: 'unverified' | 'exhaustive'
}
export interface DatabaseQueryCoverage {
  readonly completeness: 'complete' | 'partial' | 'unverified'
  readonly exactMatchCount: number | null
  readonly aggregatesComplete: boolean
  readonly description: string
}
export function evaluateDatabaseQueryCoverage(input: DatabaseQueryCoverageInput): DatabaseQueryCoverage {
  const counts = [input.candidatesReported, input.candidatesExamined, input.loaded, input.skipped]
  if (counts.some(n => !Number.isSafeInteger(n) || n < 0) ||
      input.candidatesExamined > input.candidatesReported ||
      input.loaded + input.skipped > input.candidatesExamined) {
    throw new Error('Invalid query coverage counts')
  }
  const incomplete = input.candidatesExamined < input.candidatesReported || input.skipped > 0
  const completeness = input.sourceCoverage === 'unverified' ? 'unverified'
    : incomplete ? 'partial' : 'complete'
  const exact = completeness === 'complete'
  return {
    completeness, exactMatchCount: exact ? input.loaded : null, aggregatesComplete: exact,
    description: `Loaded ${input.loaded} notes; inspected ${input.candidatesExamined} of ${input.candidatesReported} reported candidates${input.skipped ? `; ${input.skipped} unavailable or over budget` : ''}. ${exact ? 'Complete matching set verified.' : 'Counts and aggregates cover loaded notes only; full-vault completeness has not been verified.'}`,
  }
}
