export interface OperationTicket {
  generation: number
  sequence: number
}

/**
 * Gives async UI work an identity tied to the current resource lifecycle.
 * Invalidation makes all prior tickets stale; issuing a new ticket supersedes
 * prior work within the same lifecycle.
 */
export class OperationGuard {
  private generation = 0
  private sequence = 0

  invalidate(): void {
    this.generation += 1
    this.sequence += 1
  }

  snapshot(): OperationTicket {
    return { generation: this.generation, sequence: this.sequence }
  }

  issue(): OperationTicket {
    this.sequence += 1
    return { generation: this.generation, sequence: this.sequence }
  }

  isCurrent(ticket: OperationTicket): boolean {
    return ticket.generation === this.generation && ticket.sequence === this.sequence
  }
}
