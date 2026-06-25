const PREVIEW_CSS_PATH = '.scriptor/preview.css'

/** Load optional vault-level preview stylesheet when available. */
export async function loadVaultPreviewCss(
  readTextFile?: (path: string) => Promise<string | null>,
): Promise<string> {
  if (!readTextFile) return ''
  try {
    const css = await readTextFile(PREVIEW_CSS_PATH)
    return css?.trim() ?? ''
  } catch {
    return ''
  }
}

export function injectPreviewUserCss(root: HTMLElement, css: string): void {
  if (!css.trim()) return
  const existing = root.querySelector<HTMLStyleElement>('style[data-scriptor-preview-css]')
  if (existing) {
    existing.textContent = css
    return
  }
  const style = document.createElement('style')
  style.dataset.scriptorPreviewCss = 'true'
  style.textContent = css
  root.prepend(style)
}
