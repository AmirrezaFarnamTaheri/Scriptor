/** Read-only MAT-003 evidence from native Git status, never recovery authority.
 * A non-repository is not proof that there are no external file conflicts.
 */
export interface GitConflictRecoveryEvidence {
  readonly vaultId: string
  readonly state: 'ready' | 'error'
  readonly count: number
}

export function inspectGitConflictEvidence(
  vaultId: string,
  response: unknown,
): GitConflictRecoveryEvidence | undefined {
  const invalid: GitConflictRecoveryEvidence = { vaultId, state: 'error', count: 0 }
  if (!vaultId.trim() || !response || typeof response !== 'object') return invalid
  const status = response as Record<string, unknown>
  if (typeof status.is_repo !== 'boolean' || typeof status.has_conflicts !== 'boolean') return invalid
  if (!status.is_repo) return status.has_conflicts ? invalid : undefined

  const files = status.conflicted_files
  if (!Array.isArray(files) || files.length > 50_000) return invalid
  const paths = new Set<string>()
  for (const file of files) {
    if (!file || typeof file !== 'object') return invalid
    const path = (file as Record<string, unknown>).path
    if (typeof path !== 'string' || !path.trim() || path.length > 4096 || paths.has(path)) return invalid
    paths.add(path)
  }
  // Do not turn a contradictory native response into a reassuring zero.
  if (status.has_conflicts !== (paths.size > 0)) return invalid
  return { vaultId, state: 'ready', count: paths.size }
}
