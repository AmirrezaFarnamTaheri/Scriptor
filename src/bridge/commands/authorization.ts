import { invoke } from '@tauri-apps/api/core'

import { requireNative } from '../native.ts'

export type SensitiveOperation =
  | 'ai_network_request'
  | 'apply_bulk_fix'
  | 'apply_git_conflict'
  | 'code_execution'
  | 'create_backup'
  | 'daemon_control'
  | 'delete_backup'
  | 'delete_note'
  | 'git_pull'
  | 'git_push'
  | 'google_calendar_auth'
  | 'google_task_write'
  | 'import_vault'
  | 'keychain_delete'
  | 'keychain_write'
  | 'latex_compilation'
  | 'pdf_translation'
  | 'plant_uml_execution'
  | 'publish_site'
  | 'resource_sync'
  | 'restore_backup'
  | 'restore_history'

interface AuthorizationGrant {
  token: string
  operation: SensitiveOperation
  scope: string | null
  expiresAtMs: number
}

export async function authorizeSensitiveOperation(
  operation: SensitiveOperation,
  scope?: string,
): Promise<string> {
  requireNative()
  const grant = await invoke<AuthorizationGrant>('authorize_sensitive_operation', {
    operation,
    scope: scope ?? null,
  })
  return grant.token
}
