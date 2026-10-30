import type { OperationReceipt } from './operationReceipt.ts'

/** Human-readable feedback for a renderer-observed receipt; not recovery authority. */
export interface RestoreReceiptPresentation {
  readonly heading: string
  readonly explanation: string
  readonly tone: 'success' | 'warning' | 'neutral'
}

/** Never claim that a native restore committed unless its terminal status proves it. */
export function describeRestoreReceipt(receipt: OperationReceipt): RestoreReceiptPresentation {
  if (receipt.proof === 'before-native-submission') {
    return {
      heading: 'Restore not started',
      explanation: 'Approval stopped this restore before its request was sent to the native service. No files were replaced.',
      tone: 'neutral',
    }
  }
  if (receipt.proof === 'no-native-result') {
    return {
      heading: 'Restore outcome unknown',
      explanation: 'The native restore did not return a confirmed result; vault files may have changed. Restart Scriptor and reopen this vault before editing or retrying.',
      tone: 'warning',
    }
  }
  switch (receipt.nativeStatus) {
    case 'rolled-back':
      return {
        heading: 'Restore rolled back',
        explanation: 'The native restore confirmed the original vault files are unchanged. Review the backup before making another attempt.',
        tone: 'warning',
      }
    case 'committed-ready':
      return receipt.recovery === 'reopen-vault'
        ? {
            heading: 'Files restored; workspace needs recovery',
            explanation: 'The native restore confirmed file replacement, but the workspace could not refresh. Restart Scriptor and reopen this vault before editing.',
            tone: 'warning',
          }
        : {
            heading: 'Files restored',
            explanation: 'The native restore confirmed the replacement and reopened the vault session.',
            tone: 'success',
          }
    case 'committed-needs-reopen':
      return {
        heading: 'Files restored; reopen required',
        explanation: 'The native restore confirmed file replacement, but the vault session could not reopen. Restart Scriptor and open this vault before editing.',
        tone: 'warning',
      }
    case 'recovery-required':
      return {
        heading: 'Restore needs recovery',
        explanation: 'The native restore is not confirmed complete; some vault files may have changed. Restart Scriptor and reopen this vault before editing. If it cannot reopen, preserve the recovery journal.',
        tone: 'warning',
      }
    default:
      return {
        heading: 'Restore result unavailable',
        explanation: 'The restore result cannot be interpreted safely. Do not retry; restart Scriptor and reopen this vault before editing.',
        tone: 'warning',
      }
  }
}
