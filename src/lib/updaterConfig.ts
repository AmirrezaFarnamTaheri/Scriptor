/** Updater signing placeholder in default dev builds (BL-30). */
export const UPDATER_PUBKEY_PLACEHOLDER = 'dW5kZWZpbmVk'

export function isUpdaterSigningConfigured(pubkey?: string | null): boolean {
  const value = pubkey?.trim()
  return Boolean(value && value !== UPDATER_PUBKEY_PLACEHOLDER)
}
