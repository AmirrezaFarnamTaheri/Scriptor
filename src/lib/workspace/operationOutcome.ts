/**
 * Renderer-observed receipt for an existing native mutation. It does not
 * authorize writes, assert rollback from a transport failure, or auto-retry.
 */
export interface MutationScope {
  readonly operationId: string
  readonly vaultId: string
  readonly operation: string
  readonly target: string
  readonly expectedRevision?: string | null
}
export type NativeMutationProof =
  | { readonly kind: 'no-change' }
  | { readonly kind: 'committed'; readonly affectedPaths?: readonly string[]; readonly actualRevision?: string | null }
  | { readonly kind: 'recovery-required' }
export type MutationEvidence = NativeMutationProof
  | { readonly kind: 'not-submitted' }
  | { readonly kind: 'reply-missing' }
  | { readonly kind: 'invalid-native-result' }
  | { readonly kind: 'post-commit-refresh-failed'; readonly nativeStatus: 'committed-ready' | 'committed-needs-reopen' }
export interface TypedOperationOutcome {
  readonly schemaVersion: 1
  readonly operationId: string
  readonly vaultId: string
  readonly operation: string
  readonly target: string
  readonly expectedRevision: string | null
  readonly actualRevision: string | null
  /** Null means that the native owner has not reported an exhaustive inventory. */
  readonly affectedPaths: readonly string[] | null
  readonly commit: 'confirmed-none' | 'confirmed-committed' | 'indeterminate'
  readonly proof: 'before-native-submission' | 'native-result' | 'no-native-result' | 'invalid-native-result'
  readonly retry: 'review-and-reauthorize' | 'do-not-retry' | 'blocked-until-reconciliation'
  readonly recovery: 'none' | 'reopen-vault'
}
export function buildOperationOutcome(scope: MutationScope, evidence: MutationEvidence): TypedOperationOutcome {
  for (const key of ['operationId', 'vaultId', 'operation', 'target'] as const) {
    if (!scope[key].trim()) throw new Error(`Missing mutation ${key}`)
  }
  const base = {
    schemaVersion: 1 as const, operationId: scope.operationId, vaultId: scope.vaultId,
    operation: scope.operation, target: scope.target,
    expectedRevision: scope.expectedRevision ?? null, actualRevision: null,
    affectedPaths: null,
  }
  switch (evidence.kind) {
    case 'not-submitted':
      return { ...base, affectedPaths: [], commit: 'confirmed-none', proof: 'before-native-submission',
        retry: 'review-and-reauthorize', recovery: 'none' }
    case 'no-change':
      return { ...base, affectedPaths: [], commit: 'confirmed-none', proof: 'native-result',
        retry: 'review-and-reauthorize', recovery: 'none' }
    case 'committed':
      return { ...base, affectedPaths: evidence.affectedPaths === undefined ? null : [...evidence.affectedPaths],
        actualRevision: evidence.actualRevision ?? null, commit: 'confirmed-committed', proof: 'native-result',
        retry: 'do-not-retry', recovery: 'none' }
    case 'recovery-required':
      return { ...base, commit: 'indeterminate', proof: 'native-result',
        retry: 'blocked-until-reconciliation', recovery: 'reopen-vault' }
    case 'reply-missing':
      return { ...base, commit: 'indeterminate', proof: 'no-native-result',
        retry: 'blocked-until-reconciliation', recovery: 'reopen-vault' }
    case 'invalid-native-result':
      return { ...base, commit: 'indeterminate', proof: 'invalid-native-result',
        retry: 'blocked-until-reconciliation', recovery: 'reopen-vault' }
    case 'post-commit-refresh-failed':
      // A renderer refresh error alone cannot prove a native commit.
      if (evidence.nativeStatus !== 'committed-ready' &&
          evidence.nativeStatus !== 'committed-needs-reopen') {
        throw new Error('Post-commit reconciliation requires a confirmed native commit status.')
      }
      return { ...base, commit: 'confirmed-committed', proof: 'native-result',
        retry: 'blocked-until-reconciliation', recovery: 'reopen-vault' }
  }
}
export interface ObservedMutation<T> {
  readonly outcome: TypedOperationOutcome
  readonly value?: T
  readonly error?: unknown
}
/** Authorize before submission. Any failure after invoking native is indeterminate. */
export async function observeMutation<A, T>(request: {
  readonly scope: MutationScope
  readonly authorize: () => Promise<A>
  readonly submit: (grant: A) => Promise<T>
  /** Must validate the native response at runtime before classifying effects. */
  readonly interpret: (value: T) => NativeMutationProof
}): Promise<ObservedMutation<T>> {
  buildOperationOutcome(request.scope, { kind: 'not-submitted' })
  let grant: A
  try {
    grant = await request.authorize()
  } catch (error) {
    return { outcome: buildOperationOutcome(request.scope, { kind: 'not-submitted' }), error }
  }
  let value: T
  try {
    value = await request.submit(grant)
  } catch (error) {
    return { outcome: buildOperationOutcome(request.scope, { kind: 'reply-missing' }), error }
  }
  try {
    const proof = request.interpret(value)
    return { outcome: buildOperationOutcome(request.scope, proof), value }
  } catch (error) {
    // A transport response arrived but did not satisfy its contract.
    return { outcome: buildOperationOutcome(request.scope, { kind: 'invalid-native-result' }), error }
  }
}
/** A prior operation's receipt cannot appear after a vault, target, or request switch. */
export function visibleOperationOutcome(outcome: TypedOperationOutcome | null, scope: MutationScope): TypedOperationOutcome | null {
  return outcome && outcome.operationId === scope.operationId &&
    outcome.vaultId === scope.vaultId && outcome.operation === scope.operation &&
    outcome.target === scope.target ? outcome : null
}
