import type { EditorView } from '@codemirror/view'

import {
  findTableBlock,
  formatTableRow,
  isTableSeparator,
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

function activeTableBlock(view: EditorView): { block: TableBlock; from: number; to: number } | null {
  const lineIndex = view.state.doc.lineAt(view.state.selection.main.head).number - 1
  const lines = docLines(view)
  const block = findTableBlock(lines, lineIndex)
  if (!block) return null
  return {
    block,
    from: view.state.doc.line(block.startLine + 1).from,
    to: view.state.doc.line(block.endLine + 1).to,
  }
}

function applyRows(view: EditorView, block: TableBlock, from: number, to: number, rows: string[][]): void {
  const lines = docLines(view)
  const segment = rebuildTableSegment(lines, block, rows)
  view.dispatch({ changes: { from, to, insert: segment.join('\n') } })
}

function swapRows(rows: string[][], a: number, b: number): string[][] {
  const next = rows.map((row) => [...row])
  ;[next[a], next[b]] = [next[b], next[a]]
  return next
}

function swapCols(rows: string[][], a: number, b: number): string[][] {
  return rows.map((row) => {
    const next = [...row]
    ;[next[a], next[b]] = [next[b], next[a]]
    return next
  })
}

export function addRowBefore(view: EditorView): boolean {
  const active = activeTableBlock(view)
  if (!active) return false
  const lineIndex = view.state.doc.lineAt(view.state.selection.main.head).number - 1
  const rowIndex = lineIndex - active.block.startLine
  const columnCount = active.block.rows[0]?.length ?? 2
  const blank = Array.from({ length: columnCount }, () => '')
  const rows = [...active.block.rows]
  rows.splice(Math.max(0, rowIndex), 0, blank)
  applyRows(view, active.block, active.from, active.to, rows)
  return true
}

export function addRowAfter(view: EditorView): boolean {
  const active = activeTableBlock(view)
  if (!active) return false
  const lineIndex = view.state.doc.lineAt(view.state.selection.main.head).number - 1
  const rowIndex = lineIndex - active.block.startLine
  const columnCount = active.block.rows[0]?.length ?? 2
  const blank = Array.from({ length: columnCount }, () => '')
  const rows = [...active.block.rows]
  rows.splice(rowIndex + 1, 0, blank)
  applyRows(view, active.block, active.from, active.to, rows)
  return true
}

export function swapPrevRow(view: EditorView): boolean {
  const active = activeTableBlock(view)
  if (!active) return false
  const rowIndex = view.state.doc.lineAt(view.state.selection.main.head).number - 1 - active.block.startLine
  if (rowIndex <= 0) return false
  applyRows(view, active.block, active.from, active.to, swapRows(active.block.rows, rowIndex, rowIndex - 1))
  return true
}

export function swapNextRow(view: EditorView): boolean {
  const active = activeTableBlock(view)
  if (!active) return false
  const rowIndex = view.state.doc.lineAt(view.state.selection.main.head).number - 1 - active.block.startLine
  if (rowIndex >= active.block.rows.length - 1) return false
  applyRows(view, active.block, active.from, active.to, swapRows(active.block.rows, rowIndex, rowIndex + 1))
  return true
}

export function clearRow(view: EditorView): boolean {
  const active = activeTableBlock(view)
  if (!active) return false
  const rowIndex = view.state.doc.lineAt(view.state.selection.main.head).number - 1 - active.block.startLine
  const rows = active.block.rows.map((row, index) =>
    index === rowIndex ? row.map(() => '') : row,
  )
  applyRows(view, active.block, active.from, active.to, rows)
  return true
}

export function deleteRow(view: EditorView): boolean {
  const active = activeTableBlock(view)
  if (!active || active.block.rows.length <= 1) return false
  const rowIndex = view.state.doc.lineAt(view.state.selection.main.head).number - 1 - active.block.startLine
  const rows = active.block.rows.filter((_, index) => index !== rowIndex)
  applyRows(view, active.block, active.from, active.to, rows)
  return true
}

export function addColBefore(view: EditorView): boolean {
  const active = activeTableBlock(view)
  if (!active) return false
  const cell = view.state.doc.lineAt(view.state.selection.main.head).text
  const colIndex = Math.max(0, cell.split('|').length - 2)
  const rows = active.block.rows.map((row) => {
    const next = [...row]
    next.splice(colIndex, 0, '')
    return next
  })
  applyRows(view, active.block, active.from, active.to, rows)
  return true
}

export function addColAfter(view: EditorView): boolean {
  const active = activeTableBlock(view)
  if (!active) return false
  const rows = active.block.rows.map((row) => [...row, ''])
  applyRows(view, active.block, active.from, active.to, rows)
  return true
}

export function swapPrevCol(view: EditorView): boolean {
  const active = activeTableBlock(view)
  if (!active) return false
  const colIndex = 0
  if (colIndex >= (active.block.rows[0]?.length ?? 0) - 1) return false
  applyRows(view, active.block, active.from, active.to, swapCols(active.block.rows, colIndex, colIndex + 1))
  return true
}

export function swapNextCol(view: EditorView): boolean {
  const active = activeTableBlock(view)
  if (!active) return false
  const colIndex = (active.block.rows[0]?.length ?? 1) - 2
  if (colIndex < 0) return false
  applyRows(view, active.block, active.from, active.to, swapCols(active.block.rows, colIndex, colIndex + 1))
  return true
}

export function setAlignment(align: 'left' | 'center' | 'right') {
  return (view: EditorView): boolean => {
    const active = activeTableBlock(view)
    if (!active) return false
    const lines = docLines(view)
    const separatorIndex = active.block.startLine + 1
    if (separatorIndex > active.block.endLine || !isTableSeparator(lines[separatorIndex])) {
      return false
    }
    const cells = active.block.rows[0]?.map(() => {
      if (align === 'left') return ':---'
      if (align === 'right') return '---:'
      return ':---:'
    }) ?? []
    const nextLines = [...lines]
    nextLines[separatorIndex] = formatTableRow(cells)
    const segment = nextLines.slice(active.block.startLine, active.block.endLine + 1)
    view.dispatch({ changes: { from: active.from, to: active.to, insert: segment.join('\n') } })
    return true
  }
}

export function clearCol(view: EditorView): boolean {
  const active = activeTableBlock(view)
  if (!active) return false
  const colIndex = 0
  const rows = active.block.rows.map((row) => row.map((cell, index) => (index === colIndex ? '' : cell)))
  applyRows(view, active.block, active.from, active.to, rows)
  return true
}

export function deleteCol(view: EditorView): boolean {
  const active = activeTableBlock(view)
  if (!active || (active.block.rows[0]?.length ?? 0) <= 1) return false
  const colIndex = 0
  const rows = active.block.rows.map((row) => row.filter((_, index) => index !== colIndex))
  applyRows(view, active.block, active.from, active.to, rows)
  return true
}

export function clearTable(view: EditorView): boolean {
  const active = activeTableBlock(view)
  if (!active) return false
  const rows = active.block.rows.map((row) => row.map(() => ''))
  applyRows(view, active.block, active.from, active.to, rows)
  return true
}

export function deleteTable(view: EditorView): boolean {
  const active = activeTableBlock(view)
  if (!active) return false
  view.dispatch({
    changes: { from: active.from, to: active.to, insert: '' },
  })
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
