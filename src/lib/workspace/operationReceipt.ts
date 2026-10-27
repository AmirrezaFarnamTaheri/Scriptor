import type { VaultRestoreStatus } from '../../bridge/commands/vault.ts'
import { classifyVaultRestoreStatus } from '../restoreOutcome.ts'

/**
 * An observational envelope, not a new source of filesystem authority.
 * Unknown paths or revisions remain null; an empty array would falsely imply
 * that the native restore reported an exhaustive affected-path inventory.
 */
export interface OperationReceipt {
  readonly operationId: string
  readonly operationIdOrigin: 'renderer'
  readonly vaultId: string
  readonly operation: 'restore-backup'
  readonly target: string
  readonly backupPath: string
  readonly affectedPaths: readonly string[] | null
  readonly expectedRevision: string | null
  readonly actualRevision: string | null
  readonly nativeStatus: VaultRestoreStatus | null
  readonly proof: 'native-status' | 'before-native-submission' | 'no-native-result'
  readonly effect: 'none' | 'committed' | 'unreconciled' | 'unknown'
  readonly retry: 'review-and-reauthorize' | 'do-not-retry' | 'blocked-until-reopen'
  readonly recovery: 'none' | 'reopen-vault'
}

export type RestoreReceiptEvidence =
  | { readonly kind: 'native-result'; readonly status: VaultRestoreStatus }
  | { readonly kind: 'not-submitted' }
  | { readonly kind: 'reply-missing' }
  | { readonly kind: 'post-commit-refresh-failed'; readonly status: VaultRestoreStatus }

export function buildRestoreOperationReceipt(input: {
  readonly operationId: string
  readonly vaultId: string
  readonly backupName: string
  readonly backupPath: string
  readonly outcome: RestoreReceiptEvidence
}): OperationReceipt {
  const common = {
    operationId: input.operationId,
    operationIdOrigin: 'renderer' as const,
    vaultId: input.vaultId,
    operation: 'restore-backup' as const,
    target: input.backupName,
    backupPath: input.backupPath,
    affectedPaths: null,
    expectedRevision: null,
    actualRevision: null,
  }

  switch (input.outcome.kind) {
    case 'native-result': {
      const disposition = classifyVaultRestoreStatus(input.outcome.status)
      return {
        ...common,
        nativeStatus: input.outcome.status,
        proof: 'native-status',
        effect: input.outcome.status === 'recovery-required' ? 'unreconciled' : disposition.filesChanged ? 'committed' : 'none',
        retry: disposition.needsReopen
          ? 'blocked-until-reopen'
          : disposition.filesChanged ? 'do-not-retry' : 'review-and-reauthorize',
        recovery: disposition.needsReopen ? 'reopen-vault' : 'none',
      }
    }
    case 'post-commit-refresh-failed': {
      // Only committed-ready reaches renderer workspace refresh. A recovery-required
      // journal is not a proven completed commit and cannot enter this branch.
      if (input.outcome.status !== 'committed-ready') {
        throw new Error('Post-commit refresh failure requires a committed-ready native status')
      }
      return {
        ...common,
        nativeStatus: input.outcome.status,
        proof: 'native-status',
        effect: 'committed',
        retry: 'blocked-until-reopen',
        recovery: 'reopen-vault',
      }
    }
    case 'not-submitted':
      return {
        ...common,
        nativeStatus: null,
        proof: 'before-native-submission',
        effect: 'none',
        retry: 'review-and-reauthorize',
        recovery: 'none',
      }
    case 'reply-missing':
      return {
        ...common,
        nativeStatus: null,
        proof: 'no-native-result',
        effect: 'unknown',
        retry: 'blocked-until-reopen',
        recovery: 'reopen-vault',
      }
  }
}

/** Receipt visibility follows the vault AND configured backup destination. */
export function visibleOperationReceipt(
  receipt: OperationReceipt | null,
  activeVaultId: string | null,
  activeBackupPath: string,
): OperationReceipt | null {
  return receipt && receipt.vaultId === activeVaultId && receipt.backupPath === activeBackupPath ? receipt : null
}
