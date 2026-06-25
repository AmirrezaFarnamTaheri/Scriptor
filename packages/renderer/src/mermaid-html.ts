/** Convert rendered mermaid code fences into client-side diagram containers. */
export function promoteMermaidHtml(html: string): string {
  return html.replace(
    /<pre[^>]*><code class="language-mermaid"[^>]*>([\s\S]*?)<\/code><\/pre>/g,
    (_match, diagram: string) => `<div class="mermaid">${diagram}</div>`,
  )
}
