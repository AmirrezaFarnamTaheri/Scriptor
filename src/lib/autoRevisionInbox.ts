/** Conservative inbound revision cursor for short-lived connected collaboration sessions.
 * Reading a list does not mean applying it. Failed candidate IDs stay pending.
 * A review hold persists after the revision disappears from the "new" set. */
export class AutoRevisionInbox {
  private initialized = false
  private readonly seen = new Set<string>()
  private reviewRequired = false

  observe(ids: readonly string[], limit = 5): string[] {
    if (!this.initialized) {
      this.initialized = true
      for (const id of ids) this.seen.add(id)
      return []
    }
    if (this.reviewRequired) return []
    return ids.filter(id => !this.seen.has(id)).slice(0, Math.max(0, Math.min(10, limit)))
  }

  markHandled(id: string): void { this.seen.add(id) }
  blockForReview(): void { this.reviewRequired = true }
  releaseReview(): void { this.reviewRequired = false }
  get canPublish(): boolean { return this.initialized && !this.reviewRequired }

  reset(): void {
    this.initialized = false
    this.reviewRequired = false
    this.seen.clear()
  }
}
