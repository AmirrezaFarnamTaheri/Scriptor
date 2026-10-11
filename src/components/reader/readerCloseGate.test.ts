import assert from 'node:assert/strict'
import test from 'node:test'
import { createReaderCloseGate } from './readerCloseGate.ts'

test('a failed annotation flush releases the close gate for a later retry', async () => {
  const gate = createReaderCloseGate()
  let attempts = 0
  const flush = async () => ++attempts > 1
  assert.equal(await gate.request(flush), false)
  assert.equal(await gate.request(flush), true)
  assert.equal(attempts, 2)
})

test('overlapping close and switch requests share one flush without repeating the action', async () => {
  const gate = createReaderCloseGate()
  let release!: (value: boolean) => void
  let attempts = 0
  const flush = () => { attempts++; return new Promise<boolean>(resolve => { release = resolve }) }
  const first = gate.request(flush)
  const second = gate.request(flush)
  release(true)
  assert.equal(await first, true)
  assert.equal(await second, false)
  assert.equal(attempts, 1)
})
