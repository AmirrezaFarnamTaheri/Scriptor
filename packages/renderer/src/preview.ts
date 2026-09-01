import { renderMarkdownPipeline, type PreviewPipelineOptions } from './pipeline.ts'
import { escapeHtml } from './preview-utils.ts'

export { escapeHtml, sanitizeHtml } from './preview-utils.ts'

// Whole-document render cache: live preview re-renders on every keystroke
// while only a few blocks changed, but the unified pipeline processes the
// whole document. Keying on the exact input means re-renders of identical
// content (note switches, tab restores, unchanged keystrokes after debounce)
// return instantly; per-block caching inside the unified pipeline is not
// safe because footnotes and heading ids span blocks.
const RENDER_CACHE_LIMIT = 32
const renderCache = new Map<string, string>()

function renderCacheKey(markdown: string, options?: PreviewPipelineOptions): string {
  const breaks = options?.enableBreaks === true ? 'b1' : 'b0'
  const mermaid = options?.enableMermaid === false ? 'm0' : 'm1'
  return `${breaks}|${mermaid}|${markdown}`
}

export function renderMarkdownPreview(
  markdown: string,
  options?: PreviewPipelineOptions,
): string {
  const key = renderCacheKey(markdown, options)
  const cached = renderCache.get(key)
  if (cached !== undefined) {
    // Re-insert to keep least-recently-used ordering under the Map cap.
    renderCache.delete(key)
    renderCache.set(key, cached)
    return cached
  }
  try {
    const html = renderMarkdownPipeline(markdown, options)
    renderCache.set(key, html)
    if (renderCache.size > RENDER_CACHE_LIMIT) {
      const oldest = renderCache.keys().next().value
      if (oldest !== undefined) renderCache.delete(oldest)
    }
    return html
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Preview rendering failed'
    return `<p class="preview-error">${escapeHtml(message)}</p>`
  }
}
