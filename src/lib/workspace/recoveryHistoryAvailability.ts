/** Availability only; this module does not read revisions or authorize writes. */
export interface RecoveryHistoryRequest {
  vaultId: string | null
  activePath: string | null
  recoveryRequired: boolean
  settingsDirty: boolean
}

export type RecoveryHistoryReason = 'open-vault' | 'restart-vault' | 'save-settings' | 'select-note' | null
export interface RecoveryHistoryAvailability {
  allowed: boolean
  reason: RecoveryHistoryReason
}

/** Guards navigation to the existing note-history panel across vault and UI states. */
export function recoveryHistoryAvailability(request: RecoveryHistoryRequest): RecoveryHistoryAvailability {
  if (!request.vaultId) return { allowed: false, reason: 'open-vault' }
  if (request.recoveryRequired) return { allowed: false, reason: 'restart-vault' }
  if (request.settingsDirty) return { allowed: false, reason: 'save-settings' }
  if (!request.activePath?.trim()) return { allowed: false, reason: 'select-note' }
  return { allowed: true, reason: null }
}
