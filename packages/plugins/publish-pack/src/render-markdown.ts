/**
 * MCP-style markdown render helper for publish workflows.
 * Hosts with a renderer can pass `render`; otherwise returns a minimal HTML shell.
 */
export async function renderMarkdownForPublish(
  markdown: string,
  options?: {
    render?: (markdown: string) => string | Promise<string>
  },
): Promise<string> {
  const trimmed = markdown.trim()
  if (!trimmed) return ''

  if (options?.render) {
    return options.render(trimmed)
  }

  const escaped = trimmed
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
  return `<pre>${escaped}</pre>`
}
