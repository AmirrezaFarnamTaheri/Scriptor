/** One close/switch owns the flush; failures release ownership for an explicit retry. */
export function createReaderCloseGate() {
  let closing = false
  return {
    async request(flush: () => Promise<boolean>): Promise<boolean> {
      if (closing) return false
      closing = true
      try { return await flush() }
      finally { closing = false }
    },
  }
}
