/**
 * MAT-003: read-only Canvas template undo-checkpoint evidence from the existing
 * vault-owned native Canvas engine. This does not restore templates or grant
 * filesystem authority. Missing or partial evidence is never a verified zero.
 */
export interface CanvasRecoveryEvidence {
  readonly vaultId: string
  readonly state: 'ready' | 'unverified' | 'error'
  readonly count: number
}

const MAX_RECOVERY_CHECKPOINTS = 10_000
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export function inspectCanvasRecoveryEvidence(
  vaultId: string,
  result: unknown,
): CanvasRecoveryEvidence | undefined {
  if (typeof vaultId !== 'string' || !vaultId.trim()) return undefined
  const unverified: CanvasRecoveryEvidence = { vaultId, state: 'unverified', count: 0 }
  if (!record(result) || result.vaultId !== vaultId || result.complete !== true) return unverified
  const { checkpointCount, invalidCount } = result
  if (!Number.isSafeInteger(checkpointCount) || !Number.isSafeInteger(invalidCount) ||
    (checkpointCount as number) < 0 || (invalidCount as number) < 0 ||
    (checkpointCount as number) + (invalidCount as number) > MAX_RECOVERY_CHECKPOINTS ||
    (invalidCount as number) > 0) return unverified
  return { vaultId, state: 'ready', count: checkpointCount as number }
}
