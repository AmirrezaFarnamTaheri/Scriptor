let tail: Promise<void> = Promise.resolve()
let sessionGeneration = 0

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

/**
 * Replace the native active-vault session while holding the shared session
 * barrier. The generation advances only after a successful switch so readers
 * can detect results that completed against the previous vault.
 */
export function withVaultSessionSwitch<T>(operation: () => Promise<T>): Promise<T> {
  return withVaultSessionLock(async () => {
    const result = await operation()
    sessionGeneration += 1
    return result
  })
}

/**
 * Read from the active vault and retry if the native session changed while the
 * read was in flight. Callers therefore never receive an A-vault result after
 * a completed switch to vault B.
 */
export async function withStableVaultSessionRead<T>(operation: () => Promise<T>): Promise<T> {
  for (;;) {
    const observedGeneration = sessionGeneration
    const result = await operation()
    if (observedGeneration === sessionGeneration) return result
  }
}
