import { copyTextToClipboard } from '@scriptor/portal'
import { copyTextToClipboard as nativeCopyTextToClipboard } from '../bridge/commands'
import { isNativeBridgeAvailable } from '../bridge/platform'

async function nativeCopy(text: string): Promise<void> {
  await nativeCopyTextToClipboard(text)
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
