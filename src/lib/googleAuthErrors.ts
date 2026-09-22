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
