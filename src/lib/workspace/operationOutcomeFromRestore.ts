import type { OperationReceipt } from './operationReceipt.ts'
import { buildOperationOutcome, type MutationEvidence, type TypedOperationOutcome } from './operationOutcome.ts'

/** Preserve the native backup restore status: renderer receipts never confer authority. */
export function outcomeFromRestoreReceipt(receipt: OperationReceipt): TypedOperationOutcome {
  let evidence: MutationEvidence
  switch (receipt.proof) {
    case 'before-native-submission':
      if (receipt.nativeStatus !== null) throw new Error('Pre-submit receipt cannot have native status')
      evidence = { kind: 'not-submitted' }
      break
    case 'no-native-result':
      if (receipt.nativeStatus !== null) throw new Error('Missing reply cannot have native status')
      evidence = { kind: 'reply-missing' }
      break
    case 'native-status':
      switch (receipt.nativeStatus) {
        case 'rolled-back': evidence = { kind: 'no-change' }; break
        case 'committed-ready':
        case 'committed-needs-reopen':
          evidence = receipt.recovery === 'reopen-vault'
            ? { kind: 'post-commit-refresh-failed', nativeStatus: receipt.nativeStatus } : { kind: 'committed' }
          break
        case 'recovery-required': evidence = { kind: 'recovery-required' }; break
        default: throw new Error('Unknown native restore status')
      }
      break
    default: throw new Error('Unknown restore proof')
  }
  // A renderer-observed receipt is not native authority. Do not let a
  // corrupted envelope assert rollback, committed effects or safe retry
  // through fields that contradict the classified native status.
  const expected = (() => {
    if (receipt.proof === 'before-native-submission') {
      return { effect: 'none', retry: 'review-and-reauthorize', recovery: 'none' }
    }
    if (receipt.proof === 'no-native-result') {
      return { effect: 'unknown', retry: 'blocked-until-reopen', recovery: 'reopen-vault' }
    }
    switch (receipt.nativeStatus) {
      case 'rolled-back':
        return { effect: 'none', retry: 'review-and-reauthorize', recovery: 'none' }
      case 'committed-ready':
        return receipt.recovery === 'reopen-vault'
          ? { effect: 'committed', retry: 'blocked-until-reopen', recovery: 'reopen-vault' }
          : { effect: 'committed', retry: 'do-not-retry', recovery: 'none' }
      case 'committed-needs-reopen':
        return { effect: 'committed', retry: 'blocked-until-reopen', recovery: 'reopen-vault' }
      case 'recovery-required':
        return { effect: 'unreconciled', retry: 'blocked-until-reopen', recovery: 'reopen-vault' }
      default:
        throw new Error('Invalid restore receipt native status.')
    }
  })()
  if (receipt.operationIdOrigin !== 'renderer' || receipt.operation !== 'restore-backup' ||
    typeof receipt.target !== 'string' || !receipt.target.trim() ||
    receipt.effect !== expected.effect || receipt.retry !== expected.retry ||
    receipt.recovery !== expected.recovery) {
    throw new Error('Invalid restore receipt: inconsistent origin, native status or effect.')
  }
  return buildOperationOutcome({
    operationId: receipt.operationId,
    vaultId: receipt.vaultId,
    operation: receipt.operation,
    target: JSON.stringify([receipt.backupPath, receipt.target]),
    expectedRevision: receipt.expectedRevision,
  }, evidence)
}
