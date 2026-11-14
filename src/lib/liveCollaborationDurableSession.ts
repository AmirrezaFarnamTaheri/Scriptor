import {
  LIVE_COLLABORATION_PROTOCOL_VERSION,
  MAX_LIVE_UPDATE_BYTES,
  parseLiveCollaborationEnvelope,
  parseLiveCollaborationScope,
  type LiveCollaborationEnvelope,
  type LiveCollaborationScope,
} from './liveCollaborationProtocol.ts'
import { PendingCollaborationQueue } from './liveCollaborationQueue.ts'
import {
  type PreparedCollaborationChange,
  type CollaborativeMarkdown,
} from './liveCollaborationYjs.ts'
import type {
  NativeCollaborationDocument,
  NativePendingUpdate,
} from '../bridge/commands/liveCollaboration.ts'

const SCOPE_FIELDS = ['vaultId', 'roomId', 'documentId', 'epoch', 'peerId'] as const
const CANONICAL_BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/
const MAX_RECOVERY_PAGE = 64
const MAX_RECOVERY_ROWS = 64 * 1024 * 1024

export interface DurableLocalJournalPort {
  append(
    scope: NativeCollaborationDocument,
    sessionId: string,
    message: LiveCollaborationEnvelope,
  ): Promise<{ locallyDurable: boolean; duplicate: boolean }>
  pending(
    scope: NativeCollaborationDocument,
    sessionId: string,
    afterSequence: number,
  ): Promise<NativePendingUpdate[]>
}

function toBase64(value: Uint8Array): string {
  if (!(value instanceof Uint8Array) || value.byteLength < 1 ||
    value.byteLength > MAX_LIVE_UPDATE_BYTES) {
    throw new Error('Invalid or oversized local collaboration update')
  }
  // Use bounded chunks instead of spreading 256 KiB across an argument list.
  let binary = ''
  for (let offset = 0; offset < value.length; offset += 8192) {
    binary += String.fromCharCode(...value.subarray(offset, offset + 8192))
  }
  return btoa(binary)
}

function fromBase64(value: unknown): Uint8Array {
  if (typeof value !== 'string' || value.length === 0 ||
    value.length > Math.ceil(MAX_LIVE_UPDATE_BYTES / 3) * 4 ||
    !CANONICAL_BASE64.test(value)) {
    throw new Error('Invalid native recovery payload base64')
  }
  let binary: string
  try {
    binary = atob(value)
  } catch {
    throw new Error('Invalid native recovery payload base64')
  }
  if (!binary || binary.length > MAX_LIVE_UPDATE_BYTES) {
    throw new Error('Invalid native recovery payload size')
  }
  const result = Uint8Array.from(binary, character => character.charCodeAt(0))
  if (toBase64(result) !== value) throw new Error('Non-canonical native recovery payload base64')
  return result
}

interface InFlightChange {
  prepared: PreparedCollaborationChange
  message: LiveCollaborationEnvelope
}

/**
 * Explicitly opted-in, single-note coordinator; no relay connection is opened
 * here. Locally prepared text is never displayed as committed or queued for
 * publication until the native FULL/WAL journal confirms durable storage.
 *
 * A native failure leaves the exact staged Yjs update and message ID intact.
 * The only permitted continuation is retry or stop + native replay; a network
 * ACK cannot clear persisted data from renderer code.
 */
export class DurableCollaborationSession {
  private readonly scope: NativeCollaborationDocument
  private readonly wireScope: LiveCollaborationScope
  private readonly leaseId: string
  private readonly journal: DurableLocalJournalPort
  private readonly text: CollaborativeMarkdown
  private readonly queue: PendingCollaborationQueue
  private phase: 'unrecovered' | 'recovering' | 'ready' | 'blocked' | 'stopped' = 'unrecovered'
  private nextSequence = 0
  private staged: InFlightChange | null = null
  private inFlight = false

  constructor(
    scope: NativeCollaborationDocument,
    leaseId: string,
    journal: DurableLocalJournalPort,
    model: CollaborativeMarkdown,
  ) {
    const accepted = parseLiveCollaborationScope(scope)
    if (typeof scope.notePath !== 'string' || !scope.notePath.endsWith('.md') ||
      scope.notePath.length > 1024 || scope.notePath.startsWith('/') ||
      scope.notePath.split('/').some(part => !part || part === '.' || part === '..')) {
      throw new Error('Invalid collaboration note scope')
    }
    if (typeof leaseId !== 'string' || leaseId.length < 4 || leaseId.length > 160) {
      throw new Error('Invalid native collaboration session lease')
    }
    if (!journal || typeof journal.append !== 'function' || typeof journal.pending !== 'function') {
      throw new Error('Native journal append and recovery are required')
    }
    const actual = model.boundScope()
    if (SCOPE_FIELDS.some(key => accepted[key] !== actual[key])) {
      throw new Error('CRDT text model does not match approved native document scope')
    }
    if (!model.ready) throw new Error('CRDT seed must be authenticated before opening a local outbox')
    this.scope = { ...accepted, notePath: scope.notePath }
    this.wireScope = accepted
    this.leaseId = leaseId
    this.journal = journal
    this.text = model
    this.queue = new PendingCollaborationQueue(accepted)
  }

  get ready(): boolean {
    return this.phase === 'ready' && this.text.ready
  }

  get value(): string {
    return this.text.value
  }

  /** Reconstruct all locally durable updates before accepting any new edits. */
  async restore(): Promise<void> {
    if (this.phase !== 'unrecovered') throw new Error('Collaboration recovery has already started')
    this.phase = 'recovering'
    let cursor = 0
    let rows = 0
    try {
      for (;;) {
        if (this.phase === 'stopped') throw new Error('Collaboration session stopped during recovery')
        const page = await this.journal.pending(this.scope, this.leaseId, cursor)
        if (this.phase === 'stopped') throw new Error('Collaboration session stopped during recovery')
        if (!Array.isArray(page) || page.length > MAX_RECOVERY_PAGE) {
          throw new Error('Invalid native journal recovery page')
        }
        if (!page.length) break
        for (const record of page) {
          if (this.phase === 'stopped') throw new Error('Collaboration session stopped during recovery')
          if (!record || !Number.isSafeInteger(record.clientSeq) ||
            record.clientSeq <= cursor || record.clientSeq < 1 || ++rows > MAX_RECOVERY_ROWS) {
            throw new Error('Invalid native journal recovery sequence')
          }
          const envelope = parseLiveCollaborationEnvelope({
            ...this.wireScope,
            version: LIVE_COLLABORATION_PROTOCOL_VERSION,
            kind: 'LOCAL_UPDATE',
            messageId: record.messageId,
            clientSeq: record.clientSeq,
            payload: record.payload,
          }, this.wireScope)
          // Clone validation in applyRemote guarantees that corrupt CRDT data
          // cannot partially mutate the accepted document.
          const bytes = fromBase64(envelope.payload)
          this.text.applyRemote(bytes, {
            roomId: this.scope.roomId, documentId: this.scope.documentId,
            epoch: this.scope.epoch, peerId: this.scope.peerId,
          })
          this.queue.enqueue(envelope)
          cursor = record.clientSeq
          this.nextSequence = cursor
        }
        if (page.length < MAX_RECOVERY_PAGE) break
      }
      if (this.phase !== 'stopped') this.phase = 'ready'
    } catch (error) {
      if (this.phase !== 'stopped') this.phase = 'blocked'
      throw error
    }
  }

  private ensureReady(): void {
    if (!this.ready) throw new Error('Collaboration session must recover before editing')
  }

  private async commitStage(): Promise<LiveCollaborationEnvelope> {
    const stage = this.staged
    if (!stage || this.inFlight) throw new Error('No pending durable collaboration retry')
    this.inFlight = true
    try {
      const receipt = await this.journal.append(this.scope, this.leaseId, stage.message)
      if (!this.ready || this.phase === 'stopped') {
        throw new Error('Collaboration session stopped before the durable reply')
      }
      if (!receipt || receipt.locallyDurable !== true ||
        typeof receipt.duplicate !== 'boolean') {
        throw new Error('Native collaboration journal did not confirm a durable transaction')
      }
      // The exact content identity was committed, including on an ambiguous
      // result that the native journal reported as an idempotent duplicate.
      this.text.commitPrepared(stage.prepared)
      this.queue.enqueue(stage.message)
      this.staged = null
      return { ...stage.message }
    } finally {
      this.inFlight = false
    }
  }

  async edit(from: number, to: number, insert: string): Promise<LiveCollaborationEnvelope | null> {
    this.ensureReady()
    if (this.staged || this.inFlight) {
      throw new Error('A pending collaboration update must finish or retry before another edit')
    }
    const prepared = this.text.prepareChange(from, to, insert)
    if (!prepared) return null
    if (this.nextSequence >= Number.MAX_SAFE_INTEGER) {
      throw new Error('Collaboration client sequence exhausted')
    }
    const clientSeq = ++this.nextSequence
    const message = parseLiveCollaborationEnvelope({
      ...this.wireScope,
      version: LIVE_COLLABORATION_PROTOCOL_VERSION,
      kind: 'LOCAL_UPDATE',
      messageId: crypto.randomUUID(),
      clientSeq,
      payload: toBase64(prepared.update),
    }, this.wireScope)
    this.staged = { prepared, message }
    return this.commitStage()
  }

  /** Retry exactly the same Yjs bytes, message ID and sequence after an error. */
  async retry(): Promise<LiveCollaborationEnvelope> {
    this.ensureReady()
    if (!this.staged || this.inFlight) {
      throw new Error('No pending durable collaboration retry')
    }
    return this.commitStage()
  }

  /** Read-only network outbox; no renderer API can mark updates delivered. */
  pendingForRelay(): LiveCollaborationEnvelope[] {
    this.ensureReady()
    return this.queue.pending().map(message => ({ ...message }))
  }

  /** Closing revokes this renderer's ability to publish or commit a late reply. */
  stop(): void {
    if (this.phase === 'stopped') return
    this.phase = 'stopped'
    this.staged = null
    this.text.close()
  }
}
