let tail: Promise<void> = Promise.resolve()

/**
 * Serialize operations whose correctness depends on the native active-vault
 * session remaining stable for their whole lifetime.
 */
export function withVaultSessionLock<T>(operation: () => Promise<T>): Promise<T> {
  let release!: () => void
  const previous = tail.catch(() => undefined)
  tail = new Promise<void>((resolve) => {
    release = resolve
  })

  return previous
    .then(operation)
    .finally(() => {
      release()
    })
}
