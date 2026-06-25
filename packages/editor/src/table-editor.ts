import { EditorState, Range, StateField } from '@codemirror/state'
import { Decoration, EditorView, WidgetType, type DecorationSet } from '@codemirror/view'

import {
  addTableColumn,
  addTableRow,
  collectTableBlocks,
  findTableBlock,
  rebuildTableSegment,
  tableBlockHasHeader,
  type TableBlock,
  updateTableCell,
} from './transform-logic.ts'

interface TableDecorationSpec {
  from: number
  to: number
  block: TableBlock
}

function docLines(doc: EditorState['doc']): string[] {
  const lines: string[] = []
  for (let line = 1; line <= doc.lines; line += 1) {
    lines.push(doc.line(line).text)
  }
  return lines
}

function collectTableDecorations(state: EditorState): TableDecorationSpec[] {
  const lines = docLines(state.doc)
  const blocks = collectTableBlocks(lines)
  return blocks.map((block) => ({
    block,
    from: state.doc.line(block.startLine + 1).from,
    to: state.doc.line(block.endLine + 1).to,
  }))
}

function applyRowsToDocument(
  view: EditorView,
  from: number,
  to: number,
  block: TableBlock,
  rows: string[][],
): void {
  const lines = docLines(view.state.doc)
  const segment = rebuildTableSegment(lines, block, rows)
  view.dispatch({
    changes: { from, to, insert: segment.join('\n') },
  })
}

class TableEditorWidget extends WidgetType {
  spec: TableDecorationSpec

  constructor(spec: TableDecorationSpec) {
    super()
    this.spec = spec
  }

  eq(other: TableEditorWidget): boolean {
    return (
      other.spec.from === this.spec.from &&
      other.spec.to === this.spec.to &&
      JSON.stringify(other.spec.block.rows) === JSON.stringify(this.spec.block.rows)
    )
  }

  toDOM(view: EditorView): HTMLElement {
    return buildTableWidget(view, this.spec)
  }

  ignoreEvent(): boolean {
    return true
  }
}

function moveTableRow(view: EditorView, block: TableBlock, rowIndex: number, direction: -1 | 1): void {
  const swapIndex = rowIndex + direction
  const currentLines = docLines(view.state.doc)
  const currentBlock = findTableBlock(currentLines, block.startLine)
  if (!currentBlock || swapIndex < 0 || swapIndex >= currentBlock.rows.length) {
    return
  }
  const nextRows = currentBlock.rows.map((row) => [...row])
  const temp = nextRows[rowIndex]
  nextRows[rowIndex] = nextRows[swapIndex]
  nextRows[swapIndex] = temp
  const from = view.state.doc.line(currentBlock.startLine + 1).from
  const to = view.state.doc.line(currentBlock.endLine + 1).to
  applyRowsToDocument(view, from, to, currentBlock, nextRows)
}

function buildTableWidget(view: EditorView, spec: TableDecorationSpec): HTMLElement {
  const lines = docLines(view.state.doc)
  const block = findTableBlock(lines, spec.block.startLine) ?? spec.block
  const header = tableBlockHasHeader(lines, block)

  const wrapper = document.createElement('div')
  wrapper.className = 'cm-table-editor-widget'

  const table = document.createElement('table')
  table.setAttribute('role', 'grid')
  table.setAttribute('aria-label', 'Markdown pipe table')

  for (let rowIndex = 0; rowIndex < block.rows.length; rowIndex += 1) {
    const rowElement = document.createElement('tr')
    for (let columnIndex = 0; columnIndex < block.rows[rowIndex].length; columnIndex += 1) {
      const cellElement = document.createElement(header && rowIndex === 0 ? 'th' : 'td')
      cellElement.className = 'cm-table-editor-cell'
      cellElement.contentEditable = 'true'
      cellElement.spellcheck = false
      cellElement.textContent = block.rows[rowIndex][columnIndex]
      cellElement.dataset.row = String(rowIndex)
      cellElement.dataset.column = String(columnIndex)
      cellElement.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault()
          cellElement.blur()
        }
      })
      cellElement.addEventListener('blur', () => {
        const value = cellElement.textContent ?? ''
        const currentLines = docLines(view.state.doc)
        const currentBlock = findTableBlock(currentLines, block.startLine)
        if (!currentBlock) {
          return
        }
        const currentCell = currentBlock.rows[rowIndex]?.[columnIndex] ?? ''
        if (currentCell === value) {
          return
        }
        const nextRows = updateTableCell(currentBlock, rowIndex, columnIndex, value)
        const from = view.state.doc.line(currentBlock.startLine + 1).from
        const to = view.state.doc.line(currentBlock.endLine + 1).to
        applyRowsToDocument(view, from, to, currentBlock, nextRows)
      })
      rowElement.appendChild(cellElement)
    }
    table.appendChild(rowElement)
  }

  for (let rowIndex = 0; rowIndex < block.rows.length; rowIndex += 1) {
    const handleRow = table.rows[rowIndex]
    if (!handleRow) continue
    const grab = document.createElement('td')
    grab.className = 'cm-table-grab-handle'
    grab.setAttribute('aria-label', `Reorder row ${rowIndex + 1}`)
    const up = document.createElement('button')
    up.type = 'button'
    up.textContent = '↑'
    up.title = 'Move row up'
    up.addEventListener('click', () => moveTableRow(view, block, rowIndex, -1))
    const down = document.createElement('button')
    down.type = 'button'
    down.textContent = '↓'
    down.title = 'Move row down'
    down.addEventListener('click', () => moveTableRow(view, block, rowIndex, 1))
    grab.append(up, down)
    handleRow.prepend(grab)
  }

  const toolbar = document.createElement('div')
  toolbar.className = 'cm-table-editor-toolbar'

  const addRowButton = document.createElement('button')
  addRowButton.type = 'button'
  addRowButton.textContent = 'Add row'
  addRowButton.addEventListener('click', () => {
    const currentLines = docLines(view.state.doc)
    const currentBlock = findTableBlock(currentLines, block.startLine)
    if (!currentBlock) {
      return
    }
    const from = view.state.doc.line(currentBlock.startLine + 1).from
    const to = view.state.doc.line(currentBlock.endLine + 1).to
    applyRowsToDocument(view, from, to, currentBlock, addTableRow(currentBlock))
  })

  const addColumnButton = document.createElement('button')
  addColumnButton.type = 'button'
  addColumnButton.textContent = 'Add column'
  addColumnButton.addEventListener('click', () => {
    const currentLines = docLines(view.state.doc)
    const currentBlock = findTableBlock(currentLines, block.startLine)
    if (!currentBlock) {
      return
    }
    const from = view.state.doc.line(currentBlock.startLine + 1).from
    const to = view.state.doc.line(currentBlock.endLine + 1).to
    applyRowsToDocument(view, from, to, currentBlock, addTableColumn(currentBlock))
  })

  toolbar.append(addRowButton, addColumnButton)
  wrapper.append(table, toolbar)
  return wrapper
}

const tableEditorField = StateField.define<DecorationSet>({
  create(state) {
    return buildDecorations(state)
  },
  update(decorations, transaction) {
    if (!transaction.docChanged && !transaction.selection) {
      return decorations
    }
    return buildDecorations(transaction.state)
  },
  provide: (field) => EditorView.decorations.from(field),
})

function buildDecorations(state: EditorState): DecorationSet {
  const specs = collectTableDecorations(state)
  const ranges: Range<Decoration>[] = specs.map((spec) =>
    Decoration.replace({
      widget: new TableEditorWidget(spec),
      block: true,
    }).range(spec.from, spec.to),
  )
  return Decoration.set(ranges, true)
}

const tableEditorTheme = EditorView.baseTheme({
  '.cm-table-editor-widget': {
    margin: '0.35rem 0 0.75rem',
    padding: '0.35rem',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    backgroundColor: 'var(--surface)',
    maxWidth: '100%',
    overflowX: 'auto',
  },
  '.cm-table-editor-widget table': {
    width: '100%',
    borderCollapse: 'collapse',
    fontFamily: 'var(--mono)',
    fontSize: '13px',
  },
  '.cm-table-editor-cell': {
    border: '1px solid var(--border)',
    padding: '6px 8px',
    minWidth: '72px',
    verticalAlign: 'top',
    outline: 'none',
  },
  '.cm-table-editor-cell:focus': {
    boxShadow: 'inset 0 0 0 1px var(--primary)',
  },
  '.cm-table-editor-toolbar': {
    display: 'flex',
    gap: '0.5rem',
    marginTop: '0.5rem',
  },
  '.cm-table-editor-toolbar button': {
    border: '1px solid var(--border)',
    borderRadius: '6px',
    background: 'var(--surface-elevated)',
    color: 'var(--text)',
    font: 'inherit',
    fontSize: '12px',
    padding: '4px 8px',
    cursor: 'pointer',
  },
  '.cm-table-editor-toolbar button:hover': {
    borderColor: 'var(--primary)',
    color: 'var(--primary)',
  },
})

export function tableEditorExtension(enabled = true) {
  if (!enabled) {
    return []
  }
  return [tableEditorField, tableEditorTheme]
}
