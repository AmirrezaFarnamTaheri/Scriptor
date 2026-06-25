import { visit } from 'unist-util-visit'

/** Infographic callout blocks: ` ```infographic title ` */
export function remarkInfographic() {
  return (tree: Parameters<typeof visit>[0]) => {
    visit(
      tree,
      'code',
      (
        node: { lang?: string | null; meta?: string | null; value: string },
        index,
        parent: { children: unknown[] } | undefined,
      ) => {
        if (!parent || index === undefined) return
        if ((node.lang ?? '').toLowerCase() !== 'infographic') return
        const title = node.meta?.trim() || 'Infographic'
        const lines = node.value
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
        const items = lines
          .map((line) => `<li>${escapeHtml(line)}</li>`)
          .join('')
        parent.children[index] = {
          type: 'html',
          value: `<section class="infographic-block" role="group" aria-label="${escapeAttr(title)}">
  <h4>${escapeHtml(title)}</h4>
  <ul>${items}</ul>
</section>`,
        }
      },
    )
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function escapeAttr(value: string): string {
  return escapeHtml(value)
}
