import { MAX_LIVE_PENDING_BYTES, parseLiveCollaborationEnvelope, parseLiveCollaborationScope,
  type LiveCollaborationEnvelope, type LiveCollaborationScope } from './liveCollaborationProtocol.ts'

export interface LiveCollaborationAck extends LiveCollaborationScope { messageId: string; clientSeq: number }
export interface LiveCollaborationQueueSnapshot { scope: LiveCollaborationScope; updates: LiveCollaborationEnvelope[] }

/** Retry bookkeeping, NOT a durable journal. Native storage must own committed operations. */
export class PendingCollaborationQueue {
  private readonly scope: LiveCollaborationScope
  private readonly updates = new Map<string, LiveCollaborationEnvelope>()
  private readonly sequences = new Map<number, string>()
  private bytes = 0
  private readonly maxBytes: number
  constructor(scope: LiveCollaborationScope, maxBytes = MAX_LIVE_PENDING_BYTES) {
    this.maxBytes = maxBytes
    this.scope = parseLiveCollaborationScope(scope)
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > MAX_LIVE_PENDING_BYTES) throw new Error('Invalid queue budget')
  }
  enqueue(untrusted: unknown): boolean {
    const update = parseLiveCollaborationEnvelope(untrusted, this.scope)
    if (update.kind !== 'LOCAL_UPDATE' || !update.payload) throw new Error('Only local content updates may be queued')
    const existing = this.updates.get(update.messageId)
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(update)) throw new Error('Duplicate message identity has different content')
      return false
    }
    if (this.sequences.has(update.clientSeq)) throw new Error('Client sequence reused for another update')
    const bytes = update.payload.length / 4 * 3 - (update.payload.endsWith('==') ? 2 : update.payload.endsWith('=') ? 1 : 0)
    if (this.bytes + bytes > this.maxBytes) throw new Error('Collaboration pending-update budget exceeded')
    this.updates.set(update.messageId, update)
    this.sequences.set(update.clientSeq, update.messageId)
    this.bytes += bytes
    return true
  }
  acknowledge(ack: LiveCollaborationAck): boolean {
    if (!ack || Object.keys(this.scope).some(key => ack[key as keyof LiveCollaborationScope] !== this.scope[key as keyof LiveCollaborationScope])) return false
    const prior = this.updates.get(ack.messageId)
    if (!prior || prior.clientSeq !== ack.clientSeq) return false
    this.updates.delete(ack.messageId)
    this.sequences.delete(ack.clientSeq)
    const payload = prior.payload!
    this.bytes -= payload.length / 4 * 3 - (payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0)
    return true
  }
  pending(): LiveCollaborationEnvelope[] { return [...this.updates.values()].sort((a, b) => a.clientSeq - b.clientSeq) }
  snapshot(): LiveCollaborationQueueSnapshot { return { scope: { ...this.scope }, updates: this.pending() } }
  static restore(scope: LiveCollaborationScope, snapshot: unknown, maxBytes = MAX_LIVE_PENDING_BYTES): PendingCollaborationQueue {
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) throw new Error('Invalid queue snapshot')
    const record = snapshot as Record<string, unknown>
    const bound = parseLiveCollaborationScope(record.scope)
    if (Object.keys(bound).some(key => bound[key as keyof LiveCollaborationScope] !== scope[key as keyof LiveCollaborationScope])) throw new Error('Queue scope mismatch')
    if (!Array.isArray(record.updates) || record.updates.length > MAX_LIVE_PENDING_BYTES) throw new Error('Invalid queue update list')
    const restored = new PendingCollaborationQueue(scope, maxBytes)
    for (const update of record.updates) {
      if (!restored.enqueue(update)) throw new Error('Duplicate queue message identity')
    }
    return restored
  }
}
