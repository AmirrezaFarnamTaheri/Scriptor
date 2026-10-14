import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readVersionedStorage, writeVersionedStorage } from './versionedStorage.ts'

function withStorage(storage: unknown, run: () => void): void {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
  try {
    run()
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original)
    else Reflect.deleteProperty(globalThis, 'localStorage')
  }
}

const fallback = { enabled: false }
const read = () => readVersionedStorage({
  key: 'backup:test',
  schemaVersion: 1,
  fallback,
  validate: (value: unknown) => value as typeof fallback,
})

test('blocked or unavailable DOM storage uses the safe fallback', () => {
  withStorage({ getItem() { throw new Error('Storage disabled') } }, () => {
    assert.strictEqual(read(), fallback)
  })
  withStorage(undefined, () => {
    assert.strictEqual(read(), fallback)
  })
})

test('malformed values are quarantined and valid envelopes remain readable', () => {
  const contents = new Map<string, string>([['backup:test', '{invalid json']])
  withStorage({
    getItem(key: string) { return contents.get(key) ?? null },
    setItem(key: string, value: string) { contents.set(key, value) },
    removeItem(key: string) { contents.delete(key) },
  }, () => {
    assert.strictEqual(read(), fallback)
    assert.equal(contents.has('backup:test'), false)
    assert.ok([...contents.keys()].some(key => key.startsWith('backup:test:corrupt:')))
    writeVersionedStorage('backup:test', 1, { enabled: true })
    assert.deepEqual(read(), { enabled: true })
  })
})

test('unwritable storage does not throw on a settings change', () => {
  withStorage({ setItem() { throw new Error('QuotaExceededError') } }, () => {
    assert.doesNotThrow(() => writeVersionedStorage('backup:test', 1, { enabled: true }))
  })
})
