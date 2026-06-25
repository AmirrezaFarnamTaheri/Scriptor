import { renderMarkdownPipeline } from './pipeline.ts'
import { escapeHtml } from './preview-utils.ts'

export { escapeHtml, sanitizeHtml } from './preview-utils.ts'

export function renderMarkdownPreview(
  markdown: string,
  options?: import('./pipeline.ts').PreviewPipelineOptions,
): string {
  try {
    return renderMarkdownPipeline(markdown, options)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Preview rendering failed'
    return `<p class="preview-error">${escapeHtml(message)}</p>`
  }
}
