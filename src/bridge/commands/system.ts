import { invoke } from '@tauri-apps/api/core'

import { requireNative } from '../native.ts'

export async function healthCheck(): Promise<string> {
  requireNative()
  return invoke<string>('health_check')
}

export async function diagnosticsAppendEvent(
  eventType: string,
  message: string,
  detailJson: string | null,
): Promise<void> {
  requireNative()
  await invoke('diagnostics_append_event', { eventType, message, detailJson })
}

export async function keychainSetSecret(account: string, secret: string): Promise<void> {
  requireNative()
  await invoke('keychain_set_secret', { account, secret })
}

export async function keychainGetSecret(account: string): Promise<string | null> {
  requireNative()
  return invoke<string | null>('keychain_get_secret', { account })
}

export async function keychainDeleteSecret(account: string): Promise<void> {
  requireNative()
  await invoke('keychain_delete_secret', { account })
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
  return invoke<CodeChunkRunOutput>('code_chunk_run', { language, code })
}

export async function plantumlRender(source: string): Promise<{ svg: string; engine: string }> {
  requireNative()
  return invoke('plantuml_render', { source })
}

export async function vaultSaveAsset(relativePath: string, bytes: number[]): Promise<string> {
  requireNative()
  return invoke<string>('vault_save_asset', { relativePath, bytes })
}

export async function copyTextToClipboard(text: string): Promise<void> {
  requireNative()
  await invoke('copy_text_to_clipboard', { text })
}
