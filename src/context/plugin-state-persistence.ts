/**
 * Serializes per-plugin persistence so an older toggle cannot complete after a
 * newer one and restore stale state on disk. A failed write is reported to its
 * caller, but never wedges later user changes behind it.
 */
export function createPluginStatePersistenceQueue() {
  let tail = Promise.resolve()

  return {
    enqueue(task: () => Promise<void>): Promise<void> {
      const result = tail.then(task)
      tail = result.catch(() => undefined)
      return result
    },
  }
}
