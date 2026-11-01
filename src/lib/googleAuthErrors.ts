export const GOOGLE_AUTH_REQUIRED_PREFIX = 'GOOGLE_AUTH_REQUIRED:'

export function googleAuthErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.startsWith(GOOGLE_AUTH_REQUIRED_PREFIX)
    ? message.slice(GOOGLE_AUTH_REQUIRED_PREFIX.length).trim()
    : message
}

/** Stable classification for native Google credential failures. */
export function isGoogleAuthRequiredError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.startsWith(GOOGLE_AUTH_REQUIRED_PREFIX)
}

/** A missing local keychain account is not proof that an earlier grant expired.
 * Native `require_tokens` currently uses the same auth prefix for both, so
 * recognize only its fixed not-connected message (and existing test aliases).
 * Other authorization failures remain reconnect-required rather than empty.
 */
export function isGoogleAccountNotConnectedError(error: unknown): boolean {
  if (!isGoogleAuthRequiredError(error)) return false
  const message = googleAuthErrorMessage(error).trim().replace(/\.$/, '').toLowerCase()
  return message === 'google account is not connected'
    || message === 'gmail is not connected'
    || message === 'disconnected'
}
