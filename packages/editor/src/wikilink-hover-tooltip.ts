/**
 * wikilink-hover-tooltip.ts
 * -------------------------
 * CodeMirror `hoverTooltip` extension that shows a popover with the linked
 * note's title and first 200 characters when the user hovers over a `[[wikilink]]`.
 *
 * The caller supplies a `resolvePreview` function that accepts the link target
 * text and returns an async promise of `{ title, snippet }` (or null when
 * the note is not found). This keeps the extension decoupled from the bridge.
 */

import { hoverTooltip, type EditorView } from '@codemirror/view'
import type { Extension } from '@codemirror/state'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WikilinkPreview {
  title: string
  /** First ~200 chars of note content. */
  snippet: string
}

export type WikilinkPreviewResolver = (
  target: string,
) => Promise<WikilinkPreview | null>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract `[[target|alias]]` or `[[target]]` from a position in the document. */
function wikilinkAtPos(
  view: EditorView,
  pos: number,
): { from: number; to: number; target: string } | null {
  const line = view.state.doc.lineAt(pos)
  const text = line.text

  const relPos = pos - line.from

  // Find all wikilinks in the line
  const re = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g
  let match: RegExpExecArray | null

  while ((match = re.exec(text)) !== null) {
    const linkFrom = match.index
    const linkTo = match.index + match[0].length
    if (relPos >= linkFrom && relPos <= linkTo) {
      return {
        from: line.from + linkFrom,
        to: line.from + linkTo,
        target: match[1].trim(),
      }
    }
  }
  return null
}

function buildTooltipDom(preview: WikilinkPreview): HTMLElement {
  const container = document.createElement('div')
  container.className = 'cm-wikilink-tooltip'

  const title = document.createElement('strong')
  title.className = 'cm-wikilink-tooltip-title'
  title.textContent = preview.title

  const snippet = document.createElement('p')
  snippet.className = 'cm-wikilink-tooltip-snippet'
  snippet.textContent =
    preview.snippet.length > 200
      ? preview.snippet.slice(0, 200) + '…'
      : preview.snippet

  container.append(title, snippet)
  return container
}

function buildNotFoundDom(target: string): HTMLElement {
  const container = document.createElement('div')
  container.className = 'cm-wikilink-tooltip cm-wikilink-tooltip--missing'
  container.textContent = `Note not found: ${target}`
  return container
}

// ---------------------------------------------------------------------------
// Extension factory
// ---------------------------------------------------------------------------

/**
 * @param resolve  Async function that resolves a wikilink target to its preview.
 *                 Called at most once per hover; results are not cached here.
 */
export function wikilinkHoverTooltip(
  resolve: WikilinkPreviewResolver,
): Extension {
  return hoverTooltip(async (view, pos) => {
    const link = wikilinkAtPos(view, pos)
    if (!link) return null

    const preview = await resolve(link.target).catch(() => null)
    const dom = preview ? buildTooltipDom(preview) : buildNotFoundDom(link.target)

    return {
      pos: link.from,
      end: link.to,
      above: true,
      create: () => ({ dom }),
    }
  })
}
