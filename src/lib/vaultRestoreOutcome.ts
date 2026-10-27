/**
 * A native restore submission can be committed even if its reply is lost.
 * Never treat a failed invocation as a rollback without a terminal native result.
 */
export class VaultRestoreOutcomeUnknownError extends Error {
  constructor(cause: unknown) {
    super('Restore outcome was not confirmed by the native command.', { cause })
    this.name = 'VaultRestoreOutcomeUnknownError'
  }
}

/**
 * Authorization failures precede submission and retain their original cause.
 * Once the native restore has been submitted, a rejected or interrupted reply
 * is indeterminate: callers must keep editor persistence frozen until reopen.
 */
export async function runVaultRestoreWithOutcomeBoundary<TAuthorization, TResult>(
  authorize: () => Promise<TAuthorization>,
  submit: (authorization: TAuthorization) => Promise<TResult>,
): Promise<TResult> {
  const authorization = await authorize()
  try {
    return await submit(authorization)
  } catch (error) {
    throw new VaultRestoreOutcomeUnknownError(error)
  }
}

export type VaultRestoreFailureDisposition = 'safe-to-resume' | 'freeze-and-reopen' | 'committed-needs-reconciliation'

/** Never resume a superseded editor draft over files that might have been replaced. */
export function classifyVaultRestoreFailure(error: unknown, committed: boolean): VaultRestoreFailureDisposition {
  if (committed) return 'committed-needs-reconciliation'
  return error instanceof VaultRestoreOutcomeUnknownError ? 'freeze-and-reopen' : 'safe-to-resume'
}
