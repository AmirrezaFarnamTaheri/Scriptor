import { invoke } from '@tauri-apps/api/core'

import { requireNative } from '../native.ts'
import { authorizeSensitiveOperation } from './authorization.ts'

export async function healthCheck(): Promise<string> {
  requireNative()
  return invoke<string>('health_check')
}

export async function setHeadlessEngineMode(enabled: boolean): Promise<void> {
  requireNative()
  await invoke('set_headless_engine', { enabled })
}

export async function diagnosticsAppendEvent(
  eventType: string,
  message: string,
  detailJson: string | null,
): Promise<void> {
  requireNative()
  await invoke('diagnostics_append_event', { eventType, message, detailJson })
}

export async function diagnosticsExportSupportBundle(): Promise<string> {
  requireNative()
  return invoke<string>('diagnostics_export_support_bundle')
}

export async function aiProviderHasApiKey(): Promise<boolean> {
  requireNative()
  return invoke<boolean>('ai_provider_has_api_key')
}

export async function aiProviderSetApiKey(secret: string): Promise<void> {
  requireNative()
  const authorizationToken = await authorizeSensitiveOperation('keychain_write', 'ai-provider')
  await invoke('ai_provider_set_api_key', { secret, authorizationToken })
}

export async function aiProviderDeleteApiKey(): Promise<void> {
  requireNative()
  const authorizationToken = await authorizeSensitiveOperation('keychain_delete', 'ai-provider')
  await invoke('ai_provider_delete_api_key', { authorizationToken })
}

export async function aiProviderProposeDraft(
  endpoint: string,
  prompt: string,
  currentMarkdown: string,
): Promise<string> {
  requireNative()
  const authorizationToken = await authorizeSensitiveOperation('ai_network_request', endpoint)
  const proposal = await invoke<{ markdown: string }>('ai_provider_propose_draft', {
    endpoint,
    prompt,
    currentMarkdown,
    authorizationToken,
  })
  return proposal.markdown
}

export async function systemInfo(): Promise<{
  os: string
  arch: string
  family: string
  locale?: string
}> {
  requireNative()
  return invoke('system_info')
}

export interface CodeChunkRunOutput {
  exit_code: number
  stdout: string
  stderr: string
  duration_ms: number
  language: string
}

export async function codeChunkRun(language: string, code: string): Promise<CodeChunkRunOutput> {
  requireNative()
  const authorizationToken = await authorizeSensitiveOperation(
    'code_execution',
    language.trim().toLowerCase(),
  )
  return invoke<CodeChunkRunOutput>('code_chunk_run', { language, code, authorizationToken })
}

export async function plantumlRender(source: string): Promise<{ svg: string; engine: string }> {
  requireNative()
  const authorizationToken = await authorizeSensitiveOperation(
    'plant_uml_execution',
    'local-renderer',
  )
  return invoke('plantuml_render', { source, authorizationToken })
}

export async function vaultSaveAsset(relativePath: string, bytes: number[]): Promise<string> {
  requireNative()
  return invoke<string>('vault_save_asset', { relativePath, bytes })
}

export async function copyTextToClipboard(text: string): Promise<void> {
  requireNative()
  await invoke('copy_text_to_clipboard', { text })
}
