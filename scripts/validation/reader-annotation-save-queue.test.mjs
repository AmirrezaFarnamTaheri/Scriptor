import test from 'node:test'
import assert from 'node:assert/strict'

import { createReaderAnnotationSaveQueue } from '../../src/components/reader/createAnnotationSaveQueue.ts'

function deferred() {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function flushMicrotasks() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

test('reader annotation save queue replays the latest snapshot after an older save finishes', async () => {
  const firstSave = deferred()
  const secondSave = deferred()
  const saveCalls = []
  const persistedIds = []
  let saveIndex = 0

  const queue = createReaderAnnotationSaveQueue({
    saveAnnotations: async (_relPath, annotations) => {
      saveCalls.push(annotations.map((annotation) => annotation.id))
      saveIndex += 1
      await (saveIndex === 1 ? firstSave.promise : secondSave.promise)
    },
    onPersisted: (annotation) => persistedIds.push(annotation.id),
  })

  const annotationA = { id: 'a', anchor: 'p1', quote: 'Alpha', body: '', color: '#1', createdAt: '2026-08-13T00:00:00.000Z' }
  const annotationB = { id: 'b', anchor: 'p2', quote: 'Beta', body: '', color: '#2', createdAt: '2026-08-13T00:00:01.000Z' }

  queue.enqueue('docs/file.pdf', [annotationA], annotationA)
  queue.enqueue('docs/file.pdf', [annotationA, annotationB], annotationB)

  firstSave.resolve()
  await flushMicrotasks()
  secondSave.resolve()
  await flushMicrotasks()

  assert.deepEqual(saveCalls, [['a'], ['a', 'b']])
  assert.deepEqual(persistedIds, ['a', 'b'])
})

test('reader annotation save queue suppresses stale save failures when a newer snapshot succeeds', async () => {
  const firstSave = deferred()
  const secondSave = deferred()
  const errors = []
  const persistedIds = []
  let saveIndex = 0

  const queue = createReaderAnnotationSaveQueue({
    saveAnnotations: async (_relPath, annotations) => {
      saveIndex += 1
      await (saveIndex === 1 ? firstSave.promise : secondSave.promise)
      if (saveIndex === 1) {
        throw new Error(`stale-${annotations.length}`)
      }
    },
    onPersisted: (annotation) => persistedIds.push(annotation.id),
    onError: (cause) => errors.push(cause instanceof Error ? cause.message : String(cause)),
  })

  const annotationA = { id: 'a', anchor: 'p1', quote: 'Alpha', body: '', color: '#1', createdAt: '2026-08-13T00:00:00.000Z' }
  const annotationB = { id: 'b', anchor: 'p2', quote: 'Beta', body: '', color: '#2', createdAt: '2026-08-13T00:00:01.000Z' }

  queue.enqueue('docs/file.pdf', [annotationA], annotationA)
  queue.enqueue('docs/file.pdf', [annotationA, annotationB], annotationB)

  firstSave.resolve()
  await flushMicrotasks()
  secondSave.resolve()
  await flushMicrotasks()

  assert.deepEqual(errors, [])
  assert.deepEqual(persistedIds, ['a', 'b'])
})
