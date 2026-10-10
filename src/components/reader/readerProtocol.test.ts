import assert from 'node:assert/strict'
import test from 'node:test'
import { parseReaderInboundMessage } from './readerProtocol.ts'

test('EPUB positions retain exact navigation anchors alongside readable section numbers', () => {
  const position = 'epubcfi(/6/2[chapter-one]!/4/2/1:0)'
  assert.deepEqual(parseReaderInboundMessage({ type: 'POSITION', position, section: 1 }), {
    type: 'POSITION', position, section: 1,
  })
})

test('legacy and PDF position messages do not acquire invented section numbers', () => {
  assert.deepEqual(parseReaderInboundMessage({ type: 'POSITION', position: '2' }), {
    type: 'POSITION', position: '2',
  })
})

test('position messages reject invalid section metadata', () => {
  for (const section of [0, -1, 1.5, NaN, Infinity, 1_000_001, '1', null]) {
    assert.equal(parseReaderInboundMessage({ type: 'POSITION', position: 'anchor', section }), null)
  }
})
