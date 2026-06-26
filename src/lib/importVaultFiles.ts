import { vaultSaveAsset } from '../bridge/commands'
import { isNativeBridgeAvailable } from '../bridge/platform'

export async function importVaultFiles(
  files: FileList | File[],
  options?: { targetPrefix?: string; filter?: (file: File) => boolean },
): Promise<string[]> {
  if (!isNativeBridgeAvailable()) return []
  const saved: string[] = []
  const prefix = options?.targetPrefix?.replace(/\/+$/, '') ?? ''
  for (const file of Array.from(files)) {
    if (options?.filter && !options.filter(file)) continue
    const relativePath = prefix ? `${prefix}/${file.name}` : file.name
    const bytes = Array.from(new Uint8Array(await file.arrayBuffer()))
    await vaultSaveAsset(relativePath, bytes)
    saved.push(relativePath)
  }
  return saved
}

export function isMarkdownFile(file: File): boolean {
  const lower = file.name.toLowerCase()
  return lower.endsWith('.md') || lower.endsWith('.markdown')
}

export function isBibliographyFile(file: File): boolean {
  return file.name.toLowerCase().endsWith('.bib')
}
