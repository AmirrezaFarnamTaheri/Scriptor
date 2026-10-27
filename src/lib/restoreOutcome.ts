/**
 * Native restore results are not interchangeable with transport errors.
 * A committed tree must never be overwritten by a pre-restore editor draft.
 * Keep the handling policy independent of component/UI lifetime.
 */
import type { VaultRestoreResult, VaultRestoreStatus } from '../bridge/commands/vault'

export interface VaultRestoreDisposition {
  readonly filesChanged: boolean
  readonly resumeOldDraft: boolean
  readonly refreshWorkspace: boolean
  readonly needsReopen: boolean
}

export function classifyVaultRestoreStatus(status: VaultRestoreStatus): VaultRestoreDisposition {
  switch (status) {
    case 'rolled-back':
      return { filesChanged: false, resumeOldDraft: true, refreshWorkspace: false, needsReopen: false }
    case 'committed-ready':
      return { filesChanged: true, resumeOldDraft: false, refreshWorkspace: true, needsReopen: false }
    case 'committed-needs-reopen':
    case 'recovery-required':
      return { filesChanged: true, resumeOldDraft: false, refreshWorkspace: false, needsReopen: true }
    default:
      throw new VaultRestoreOutcomeUnknownError(new Error('Unknown native restore status'))
  }
}

/** A native restore may have committed even if the renderer never received its reply. */
export class VaultRestoreOutcomeUnknownError extends Error {
  constructor(cause: unknown) {
    super('Restore outcome was not confirmed by the native command.', { cause })
    this.name = 'VaultRestoreOutcomeUnknownError'
  }
}

/**
 * Authorization failures are known to precede native submission. After
 * submission begins, any rejection is an unknown commit outcome.
 * Never automatically retry a potentially committed restore.
 */
export async function runVaultRestoreWithOutcomeBoundary<TAuthorization, TResult>(
  authorize: () => Promise<TAuthorization>,
  submit: (authorization: TAuthorization) => Promise<TResult>,
): Promise<TResult> {
  const authorization = await authorize()
  try {
    return await submit(authorization)
  } catch (cause) {
    throw new VaultRestoreOutcomeUnknownError(cause)
  }
}

export type VaultRestoreFailureDisposition = 'safe-to-resume' | 'freeze-and-reopen' | 'committed-needs-reconciliation'

/** A rejected native invocation must not release a superseded editor draft. */
export function classifyVaultRestoreFailure(error: unknown, committed: boolean): VaultRestoreFailureDisposition {
  if (committed) return 'committed-needs-reconciliation'
  return error instanceof VaultRestoreOutcomeUnknownError ? 'freeze-and-reopen' : 'safe-to-resume'
}

/** Validate native Tauri payloads after submission; a typed invoke is not runtime validation. */
export function validateVaultRestoreResult(value: unknown): VaultRestoreResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid native restore result: expected an object')
  }
  const record = value as Record<string, unknown>
  if (typeof record.message !== 'string' ||
    (record.status !== 'rolled-back' && record.status !== 'committed-ready' &&
      record.status !== 'committed-needs-reopen' && record.status !== 'recovery-required')) {
    throw new Error('Invalid native restore result: status or message is missing')
  }
  return value as VaultRestoreResult
}
