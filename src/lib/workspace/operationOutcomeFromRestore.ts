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
            ? { kind: 'post-commit-refresh-failed' } : { kind: 'committed' }
          break
        case 'recovery-required': evidence = { kind: 'recovery-required' }; break
        default: throw new Error('Unknown native restore status')
      }
      break
    default: throw new Error('Unknown restore proof')
  }
  return buildOperationOutcome({
    operationId: receipt.operationId,
    vaultId: receipt.vaultId,
    operation: receipt.operation,
    target: JSON.stringify([receipt.backupPath, receipt.target]),
    expectedRevision: receipt.expectedRevision,
  }, evidence)
}
