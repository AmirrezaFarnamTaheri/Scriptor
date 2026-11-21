import type { EditorView } from '@codemirror/view'

import {
  findTableBlock,
  isTableSeparator,
  parseTableRow,
  rebuildTableSegment,
  type TableBlock,
} from './transform-logic.ts'

function docLines(view: EditorView): string[] {
  const lines: string[] = []
  for (let line = 1; line <= view.state.doc.lines; line += 1) {
    lines.push(view.state.doc.line(line).text)
  }
  return lines
}

interface ActiveTable {
  block: TableBlock
  lines: string[]
  from: number
  to: number
  /** Index into `block.rows` (header is 0), or null when the caret is on the delimiter row. */
  rowIndex: number | null
  /** Column under the caret, clamped to the table width. */
  colIndex: number
  columnCount: number
  /** Delimiter cells, or null for a table without a delimiter row. */
  delimiter: string[] | null
}

/** Counts unescaped pipes before the caret to find the cell it is in. */
function columnAt(lineText: string, offset: number): number {
  const before = lineText.slice(0, offset).replace(/^\s*\|/, '')
  return (before.match(/(?<!\\)\|/g) ?? []).length
}

function activeTable(view: EditorView): ActiveTable | null {
  const head = view.state.selection.main.head
  const caretLine = view.state.doc.lineAt(head)
  const lineIndex = caretLine.number - 1
  const lines = docLines(view)
  const block = findTableBlock(lines, lineIndex)
  if (!block) return null
  const separatorIndex = lines.slice(block.startLine, block.endLine + 1).findIndex((line) => isTableSeparator(line))
  let rowIndex: number | null = null
  if (!isTableSeparator(lines[lineIndex])) {
    rowIndex = 0
    for (let index = block.startLine; index < lineIndex; index += 1) {
      if (!isTableSeparator(lines[index])) rowIndex += 1
    }
  }
  const columnCount = block.rows[0]?.length ?? 0
  const colIndex = Math.min(Math.max(0, columnCount - 1), columnAt(caretLine.text, head - caretLine.from))
  const delimiter = separatorIndex < 0
    ? null
    : Array.from({ length: columnCount }, (_, index) => parseTableRow(lines[block.startLine + separatorIndex])[index] ?? '---')
  return {
    block,
    lines,
    from: view.state.doc.line(block.startLine + 1).from,
    to: view.state.doc.line(block.endLine + 1).to,
    rowIndex,
    colIndex,
    columnCount,
    delimiter,
  }
}

function applyRows(view: EditorView, active: ActiveTable, rows: string[][], delimiter?: string[]): void {
  const segment = rebuildTableSegment(active.lines, active.block, rows, delimiter)
  view.dispatch({ changes: { from: active.from, to: active.to, insert: segment.join('\n') } })
}

function moveItem<T>(items: T[], from: number, to: number): T[] {
  const next = [...items]
  ;[next[from], next[to]] = [next[to], next[from]]
  return next
}

function blankRow(active: ActiveTable): string[] {
  return Array.from({ length: Math.max(1, active.columnCount) }, () => '')
}

function insertRow(view: EditorView, offset: 0 | 1): boolean {
  const active = activeTable(view)
  if (!active || active.rowIndex === null) return false
  const rows = [...active.block.rows]
  rows.splice(active.rowIndex + offset, 0, blankRow(active))
  applyRows(view, active, rows)
  return true
}

export function addRowBefore(view: EditorView): boolean {
  return insertRow(view, 0)
}

export function addRowAfter(view: EditorView): boolean {
  return insertRow(view, 1)
}

function moveRow(view: EditorView, step: -1 | 1): boolean {
  const active = activeTable(view)
  if (!active || active.rowIndex === null) return false
  const target = active.rowIndex + step
  if (target < 0 || target >= active.block.rows.length) return false
  applyRows(view, active, moveItem(active.block.rows, active.rowIndex, target))
  return true
}

export function swapPrevRow(view: EditorView): boolean {
  return moveRow(view, -1)
}

export function swapNextRow(view: EditorView): boolean {
  return moveRow(view, 1)
}

export function clearRow(view: EditorView): boolean {
  const active = activeTable(view)
  if (!active || active.rowIndex === null) return false
  applyRows(view, active, active.block.rows.map((row, index) => (index === active.rowIndex ? row.map(() => '') : row)))
  return true
}

export function deleteRow(view: EditorView): boolean {
  const active = activeTable(view)
  if (!active || active.rowIndex === null || active.block.rows.length <= 1) return false
  applyRows(view, active, active.block.rows.filter((_, index) => index !== active.rowIndex))
  return true
}

function insertColumn(view: EditorView, offset: 0 | 1): boolean {
  const active = activeTable(view)
  if (!active) return false
  const at = active.colIndex + offset
  const rows = active.block.rows.map((row) => {
    const next = [...row]
    next.splice(at, 0, '')
    return next
  })
  const delimiter = active.delimiter ? [...active.delimiter] : undefined
  delimiter?.splice(at, 0, '---')
  applyRows(view, active, rows, delimiter)
  return true
}

export function addColBefore(view: EditorView): boolean {
  return insertColumn(view, 0)
}

export function addColAfter(view: EditorView): boolean {
  return insertColumn(view, 1)
}

function moveColumn(view: EditorView, step: -1 | 1): boolean {
  const active = activeTable(view)
  if (!active) return false
  const target = active.colIndex + step
  if (target < 0 || target >= active.columnCount) return false
  const rows = active.block.rows.map((row) => moveItem(row, active.colIndex, target))
  applyRows(view, active, rows, active.delimiter ? moveItem(active.delimiter, active.colIndex, target) : undefined)
  return true
}

export function swapPrevCol(view: EditorView): boolean {
  return moveColumn(view, -1)
}

export function swapNextCol(view: EditorView): boolean {
  return moveColumn(view, 1)
}

/** Sets the alignment of the column under the caret only. */
export function setAlignment(align: 'left' | 'center' | 'right') {
  return (view: EditorView): boolean => {
    const active = activeTable(view)
    if (!active || !active.delimiter) return false
    const delimiter = [...active.delimiter]
    delimiter[active.colIndex] = align === 'left' ? ':---' : align === 'right' ? '---:' : ':---:'
    applyRows(view, active, active.block.rows, delimiter)
    return true
  }
}

export function clearCol(view: EditorView): boolean {
  const active = activeTable(view)
  if (!active) return false
  applyRows(view, active, active.block.rows.map((row) => row.map((cell, index) => (index === active.colIndex ? '' : cell))), active.delimiter ?? undefined)
  return true
}

export function deleteCol(view: EditorView): boolean {
  const active = activeTable(view)
  if (!active || active.columnCount <= 1) return false
  const keep = (_: unknown, index: number) => index !== active.colIndex
  applyRows(view, active, active.block.rows.map((row) => row.filter(keep)), active.delimiter?.filter(keep))
  return true
}

export function clearTable(view: EditorView): boolean {
  const active = activeTable(view)
  if (!active) return false
  applyRows(view, active, active.block.rows.map((row) => row.map(() => '')), active.delimiter ?? undefined)
  return true
}

export function deleteTable(view: EditorView): boolean {
  const active = activeTable(view)
  if (!active) return false
  view.dispatch({ changes: { from: active.from, to: active.to, insert: '' } })
  return true
}

export type TableContextAction =
  | 'insert.row.above'
  | 'insert.row.below'
  | 'move.row.up'
  | 'move.row.down'
  | 'clear.row'
  | 'delete.row'
  | 'insert.col.left'
  | 'insert.col.right'
  | 'move.col.left'
  | 'move.col.right'
  | 'align.col.left'
  | 'align.col.center'
  | 'align.col.right'
  | 'clear.col'
  | 'delete.col'
  | 'clear.table'
  | 'delete.table'

export function runTableContextAction(view: EditorView, action: TableContextAction): boolean {
  const handlers: Record<TableContextAction, (view: EditorView) => boolean> = {
    'insert.row.above': addRowBefore,
    'insert.row.below': addRowAfter,
    'move.row.up': swapPrevRow,
    'move.row.down': swapNextRow,
    'clear.row': clearRow,
    'delete.row': deleteRow,
    'insert.col.left': addColBefore,
    'insert.col.right': addColAfter,
    'move.col.left': swapPrevCol,
    'move.col.right': swapNextCol,
    'align.col.left': setAlignment('left'),
    'align.col.center': setAlignment('center'),
    'align.col.right': setAlignment('right'),
    'clear.col': clearCol,
    'delete.col': deleteCol,
    'clear.table': clearTable,
    'delete.table': deleteTable,
  }
  return handlers[action](view)
}

export const TABLE_CONTEXT_MENU: Array<{ id: TableContextAction; label: string; group?: string }> = [
  { id: 'insert.row.above', label: 'Insert row above', group: 'row' },
  { id: 'insert.row.below', label: 'Insert row below', group: 'row' },
  { id: 'move.row.up', label: 'Move row up', group: 'row' },
  { id: 'move.row.down', label: 'Move row down', group: 'row' },
  { id: 'clear.row', label: 'Clear row', group: 'row' },
  { id: 'delete.row', label: 'Delete row', group: 'row' },
  { id: 'insert.col.left', label: 'Insert column left', group: 'col' },
  { id: 'insert.col.right', label: 'Insert column right', group: 'col' },
  { id: 'move.col.left', label: 'Move column left', group: 'col' },
  { id: 'move.col.right', label: 'Move column right', group: 'col' },
  { id: 'align.col.left', label: 'Align left', group: 'col' },
  { id: 'align.col.center', label: 'Align center', group: 'col' },
  { id: 'align.col.right', label: 'Align right', group: 'col' },
  { id: 'clear.col', label: 'Clear column', group: 'col' },
  { id: 'delete.col', label: 'Delete column', group: 'col' },
  { id: 'clear.table', label: 'Clear table', group: 'table' },
  { id: 'delete.table', label: 'Delete table', group: 'table' },
]
