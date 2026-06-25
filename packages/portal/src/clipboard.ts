export async function copyTextToClipboard(text: string, nativeCopy?: (text: string) => Promise<void>): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch {
      // fall through
    }
  }
  if (nativeCopy) {
    await nativeCopy(text)
    return
  }
  throw new Error('Clipboard API is unavailable')
}
