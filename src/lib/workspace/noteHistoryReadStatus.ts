/** An observational distinction between loading, failed and confirmed-empty history. */
export type NoteHistoryReadStatus = 'select-note' | 'blocked' | 'loading' | 'error' | 'empty' | 'available'
export interface NoteHistoryScope { readonly path: string | null; readonly vaultId: string | null }
export interface NoteHistoryEvidence {
  readonly path: string
  readonly vaultId: string
  readonly count: number
  readonly error: string | null
}
export function noteHistoryReadStatus(
  scope: NoteHistoryScope,
  evidence: NoteHistoryEvidence | null,
): NoteHistoryReadStatus {
  if (!scope.path) return 'select-note'
  if (!scope.vaultId) return 'blocked'
  if (!evidence || scope.path !== evidence.path || scope.vaultId !== evidence.vaultId) return 'loading'
  if (evidence.error || !Number.isSafeInteger(evidence.count) || evidence.count < 0) return 'error'
  return evidence.count === 0 ? 'empty' : 'available'
}
