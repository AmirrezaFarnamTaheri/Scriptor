/**
 * Mermaid enhancement for the rendered preview.
 *
 * Mermaid's own `run()` is all-or-nothing: it rejects on the first diagram that
 * fails to parse, so one bad fence left every later diagram on the page
 * unrendered. It also leaves the failing node looking like ordinary body text, with
 * nothing to say a render was attempted and why it did not happen.
 *
 * Each node is therefore rendered on its own, and a node that fails is replaced
 * with an explicit, readable failure block that keeps the original source. A
 * diagram either renders or says why it did not — never a broken image glyph and
 * never silently ambiguous prose.
 */

import { createMermaidPreviewRenderer } from './mermaid-coordinator.ts'

/** The subset of Mermaid's API this module needs, so it can be stubbed in tests. */
export interface MermaidRenderer {
  run(options: { nodes: HTMLElement[] }): Promise<unknown>
}

const FAILURE_CLASS = 'mermaid-render-failure'

/**
 * The specific reason a diagram failed, or `null` when the error carried none.
 *
 * Returning `null` matters: the block already says a diagram could not be
 * rendered, so a generic fallback reason would state the same fact twice in a row.
 */
function failureDetail(error: unknown): string | null {
  if (error instanceof Error && error.message.trim()) return error.message.trim()
  if (typeof error === 'string' && error.trim()) return error.trim()
  return null
}

/**
 * Replaces a failed node with a labelled block containing its source.
 *
 * `source` must be captured *before* `run()` is called. Mermaid mutates the node
 * in place before it rejects — on a parse error it injects its own error SVG and a
 * block of generated CSS — so reading the node afterwards yields mermaid's error
 * markup instead of the diagram the author wrote.
 */
function markFailed(node: HTMLElement, source: string, error: unknown): void {
  if (node.classList.contains(FAILURE_CLASS)) return
  node.classList.add(FAILURE_CLASS)
  node.setAttribute('role', 'note')
  node.removeAttribute('data-processed')
  node.textContent = ''

  const heading = node.ownerDocument.createElement('strong')
  heading.className = 'mermaid-failure-title'
  heading.textContent = 'Diagram could not be rendered'

  const code = node.ownerDocument.createElement('code')
  code.className = 'mermaid-failure-source'
  code.textContent = source.trim()

  node.append(heading)
  // Only when the failure carried a reason worth repeating; the heading already
  // says the diagram did not render.
  const detail = failureDetail(error)
  if (detail) {
    const reason = node.ownerDocument.createElement('span')
    reason.className = 'mermaid-failure-reason'
    reason.textContent = detail
    node.append(reason)
  }
  node.append(code)
}

/**
 * Renders every `.mermaid` node under `root`, isolating failures per node.
 *
 * Returns how many nodes failed so callers can report it. Never throws: a
 * diagram that cannot render must not take the rest of the preview with it.
 */
export async function renderMermaidDiagrams(
  root: HTMLElement,
  loadMermaid: () => Promise<MermaidRenderer> = async () => createMermaidPreviewRenderer(),
): Promise<{ rendered: number; failed: number }> {
  const nodes = Array.from(root.querySelectorAll<HTMLElement>('.mermaid'))
  if (nodes.length === 0) return { rendered: 0, failed: 0 }

  const mermaid = await loadMermaid()
  let rendered = 0
  let failed = 0

  for (const node of nodes) {
    // A node already marked by an earlier pass must not be re-rendered or cleared.
    if (node.classList.contains(FAILURE_CLASS)) {
      failed += 1
      continue
    }
    // Captured before `run()`, which overwrites the node's contents on failure.
    const source = node.textContent ?? ''
    try {
      await mermaid.run({ nodes: [node] })
      rendered += 1
    } catch (error) {
      failed += 1
      markFailed(node, source, error)
    }
  }

  return { rendered, failed }
}
