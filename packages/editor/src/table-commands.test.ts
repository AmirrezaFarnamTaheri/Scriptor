import assert from 'node:assert/strict'
import test from 'node:test'
import { EditorSelection, EditorState, type TransactionSpec } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'

import { runTableContextAction, type TableContextAction } from './table-commands.ts'
import { rebuildTableSegment, findTableBlock } from './transform-logic.ts'

const TABLE = ['| A | B | C |', '| :--- | :---: | ---: |', '| a1 | b1 | c1 |', '| a2 | b2 | c2 |'].join('\n')

/** A view stand-in: the commands only read `state` and call `dispatch`. */
function run(action: TableContextAction, caretLine: number, caretCell: string, doc = TABLE): string {
  let state = EditorState.create({ doc })
  const line = state.doc.line(caretLine)
  const offset = line.text.indexOf(caretCell)
  assert.ok(offset >= 0, `caret cell ${caretCell} not on line ${caretLine}`)
  state = state.update({ selection: EditorSelection.cursor(line.from + offset) }).state
  const view = { get state() { return state }, dispatch(spec: TransactionSpec) { state = state.update(spec).state } }
  runTableContextAction(view as unknown as EditorView, action)
  return state.doc.toString()
}

const rows = (text: string) => text.split('\n')

test('row commands act on the body row under the caret, not the next one', () => {
  assert.deepEqual(rows(run('delete.row', 3, 'a1')), ['| A | B | C |', '| :--- | :---: | ---: |', '| a2 | b2 | c2 |'])
  assert.equal(rows(run('clear.row', 3, 'b1'))[2], '|  |  |  |')
  assert.equal(rows(run('insert.row.above', 3, 'a1'))[2], '|  |  |  |')
  assert.equal(rows(run('insert.row.below', 3, 'a1'))[3], '|  |  |  |')
  assert.deepEqual(rows(run('move.row.down', 3, 'a1')).slice(2), ['| a2 | b2 | c2 |', '| a1 | b1 | c1 |'])
  assert.deepEqual(rows(run('move.row.up', 4, 'a2')).slice(2), ['| a2 | b2 | c2 |', '| a1 | b1 | c1 |'])
})

test('column commands act on the column under the caret and keep the delimiter row valid', () => {
  assert.deepEqual(rows(run('delete.col', 3, 'b1')), ['| A | C |', '| :--- | ---: |', '| a1 | c1 |', '| a2 | c2 |'])
  assert.deepEqual(rows(run('clear.col', 3, 'c1')).slice(2), ['| a1 | b1 |  |', '| a2 | b2 |  |'])
  assert.deepEqual(rows(run('insert.col.left', 3, 'b1')).slice(0, 2), ['| A |  | B | C |', '| :--- | --- | :---: | ---: |'])
  assert.deepEqual(rows(run('insert.col.right', 3, 'a1')).slice(0, 2), ['| A |  | B | C |', '| :--- | --- | :---: | ---: |'])
  assert.deepEqual(rows(run('move.col.left', 3, 'c1')).slice(0, 2), ['| A | C | B |', '| :--- | ---: | :---: |'])
  assert.deepEqual(rows(run('move.col.right', 3, 'a1')).slice(0, 2), ['| B | A | C |', '| :---: | :--- | ---: |'])
  assert.equal(rows(run('align.col.right', 3, 'a1'))[1], '| ---: | :---: | ---: |')
  assert.equal(rows(run('align.col.center', 1, 'C'))[1], '| :--- | :---: | :---: |')
})

test('escaped pipes stay inside their cell', () => {
  const doc = ['| x\\|y | z |', '| --- | --- |', '| 1 | 2 |'].join('\n')
  assert.deepEqual(rows(run('delete.col', 1, 'z', doc)), ['| x\\|y |', '| --- |', '| 1 |'])
})

test('rebuilding a table after adding a column keeps header and delimiter widths equal', () => {
  const lines = ['| A | B |', '| --- | ---: |', '| 1 | 2 |']
  const block = findTableBlock(lines, 0)!
  const rebuilt = rebuildTableSegment(lines, block, block.rows.map((row) => [...row, '']))
  assert.deepEqual(rebuilt, ['| A | B |  |', '| --- | ---: | --- |', '| 1 | 2 |  |'])
})
