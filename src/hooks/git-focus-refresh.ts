/** Coalesce focus storms without suppressing explicit refreshes after mutations. */
export function createGitFocusRefresh(refresh: () => Promise<void>, now = Date.now) {
  let pending = false
  let lastStarted = -Infinity
  return async () => {
    if (pending || now() - lastStarted < 2_000) return
    pending = true
    lastStarted = now()
    try {
      await refresh()
    } finally {
      pending = false
    }
  }
}
