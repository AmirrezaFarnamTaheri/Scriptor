/**
 * The public Desktop OAuth client ID identifies the distributed Scriptor app,
 * not the user. Personal credentials remain in Google's browser flow and the
 * existing operating-system keychain, never in this configuration.
 */
export function selectGoogleOAuthClientId(
  packagedClientId: string | null | undefined,
  legacyClientId: string | null | undefined,
): string {
  const packaged = packagedClientId?.trim() ?? ''
  return packaged || legacyClientId?.trim() || ''
}

export function getGoogleOAuthClientId(legacyClientId?: string | null): string {
  return selectGoogleOAuthClientId(import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID, legacyClientId)
}

export function hasPackagedGoogleOAuthClient(): boolean {
  return Boolean(import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID?.trim())
}
