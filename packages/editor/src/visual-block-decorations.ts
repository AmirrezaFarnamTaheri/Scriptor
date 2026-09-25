import { StateField, type Extension, type Range, type Text } from '@codemirror/state'
import {
  Decoration,
  EditorView,
  WidgetType,
  type DecorationSet,
} from '@codemirror/view'

import type {
  MarkdownVisualBlockRenderRequest,
  MarkdownVisualBlockRenderer,
} from './visual-block.ts'

interface FencedBlock {
  from: number
  to: number
  source: string
  language: string
  meta: string
}

/** Finds complete Markdown fences, including the common backtick and tilde forms. */
export function findFencedBlocks(doc: Text): FencedBlock[] {
  const blocks: FencedBlock[] = []
  let open: (FencedBlock & { markerChar: string; markerLength: number; sourceFrom: number }) | null = null

  for (let lineNumber = 1; lineNumber <= doc.lines; lineNumber += 1) {
    const line = doc.line(lineNumber)
    const match = /^\s{0,3}(`{3,}|~{3,})([^\r\n]*)$/.exec(line.text)
    if (!match) continue
    const marker = match[1]!
    const markerChar = marker[0]
    const info = match[2]!.trim()

    if (open) {
      if (markerChar === open.markerChar && marker.length >= open.markerLength && !info) {
        const sourceLines: string[] = []
        for (let number = open.sourceFrom; number < lineNumber; number += 1) {
          sourceLines.push(doc.line(number).text)
        }
        blocks.push({
          from: open.from,
          to: line.to,
          source: sourceLines.join('\n'),
          language: open.language,
          meta: open.meta,
        })
        open = null
      }
      continue
    }

    // An info string on a backtick fence cannot itself contain a backtick.
    if (markerChar === '`' && info.includes('`')) continue
    const [language = '', ...metaParts] = info.split(/\s+/)
    open = {
      from: line.from,
      to: line.to,
      source: '',
      language,
      meta: metaParts.join(' '),
      markerChar,
      markerLength: marker.length,
      sourceFrom: lineNumber + 1,
    }
  }

  // Incomplete fences are deliberately not returned: they must stay visible
  // as editable Markdown source.
  return blocks
}

function requestFor(doc: Text, block: FencedBlock): MarkdownVisualBlockRenderRequest {
  return {
    raw: doc.sliceString(block.from, block.to),
    source: block.source,
    language: block.language,
    meta: block.meta,
    from: block.from,
    to: block.to,
  }
}

class VisualBlockWidget extends WidgetType {
  private readonly request: MarkdownVisualBlockRenderRequest
  private readonly renderer: MarkdownVisualBlockRenderer

  constructor(request: MarkdownVisualBlockRenderRequest, renderer: MarkdownVisualBlockRenderer) {
    super()
    this.request = request
    this.renderer = renderer
  }

  eq(other: VisualBlockWidget): boolean {
    return other.request.raw === this.request.raw && other.renderer === this.renderer
  }

  toDOM(view: EditorView): HTMLElement {
    const root = document.createElement('div')
    root.className = 'cm-visual-block cm-visual-block-content markdown-preview'
    root.dataset.visualBlock = this.request.language || 'code'
    root.setAttribute('aria-label', `${this.request.language || 'Code'} block; activate to edit`)

    const renderFallback = () => {
      root.replaceChildren()
      const pre = document.createElement('pre')
      const code = document.createElement('code')
      if (this.request.language) code.className = `language-${this.request.language}`
      code.textContent = this.request.source
      pre.append(code)
      root.append(pre)
    }

    try {
      const result = this.renderer(this.request, root)
      if (result && typeof result.then === 'function') {
        void result.catch(renderFallback)
      }
    } catch {
      renderFallback()
    }

    root.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null
      if (target?.closest('button, a, input, textarea, select, [data-mpe-run="true"]')) return
      view.dispatch({
        selection: { anchor: this.request.from },
        effects: EditorView.scrollIntoView(this.request.from, { y: 'nearest' }),
      })
      view.focus()
    })
    return root
  }
}

function buildDecorations(
  state: { doc: Text; selection: { main: { head: number } } },
  renderer: MarkdownVisualBlockRenderer | null,
): DecorationSet {
  if (!renderer) return Decoration.none
  const decorations: Range<Decoration>[] = []
  const head = state.selection.main.head
  for (const block of findFencedBlocks(state.doc)) {
    if (head >= block.from && head <= block.to) continue
    decorations.push(
      Decoration.replace({
        block: true,
        widget: new VisualBlockWidget(requestFor(state.doc, block), renderer),
      }).range(block.from, block.to),
    )
  }
  return Decoration.set(decorations, true)
}

export function visualBlockDecorations(renderer: MarkdownVisualBlockRenderer | null): Extension {
  return StateField.define<DecorationSet>({
    create: (state) => buildDecorations(state, renderer),
    update: (value, transaction) => {
      if (!transaction.docChanged && !transaction.selection) return value
      return buildDecorations(transaction.state, renderer)
    },
    provide: (field) => EditorView.decorations.from(field),
  })
}
