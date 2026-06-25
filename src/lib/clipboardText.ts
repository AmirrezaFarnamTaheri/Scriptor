import { invoke } from '@tauri-apps/api/core'

import { copyTextToClipboard } from '@scriptor/portal'
import { isNativeBridgeAvailable } from '../bridge/platform'

async function nativeCopy(text: string): Promise<void> {
  await invoke('copy_text_to_clipboard', { text })
}

/** Copy plain text via web clipboard or Tauri native command. */
export async function writeClipboardText(text: string): Promise<void> {
  await copyTextToClipboard(text, isNativeBridgeAvailable() ? nativeCopy : undefined)
}

export async function readClipboardText(): Promise<string | null> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) return null
  try {
    return await navigator.clipboard.readText()
  } catch {
    return null
  }
}
