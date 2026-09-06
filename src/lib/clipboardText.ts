import { copyTextToClipboard } from '@scriptor/portal'
import { copyTextToClipboard as nativeCopyTextToClipboard } from '../bridge/commands'
import { isNativeBridgeAvailable } from '../bridge/platform'

/** Copy plain text via web clipboard or Tauri native command. */
export async function writeClipboardText(text: string): Promise<void> {
  await copyTextToClipboard(text, isNativeBridgeAvailable() ? nativeCopyTextToClipboard : undefined)
}

/** Read plain text from the browser clipboard when that capability is available. */
export async function readClipboardText(): Promise<string | null> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.readText) return null
  try {
    return await navigator.clipboard.readText()
  } catch {
    return null
  }
}
