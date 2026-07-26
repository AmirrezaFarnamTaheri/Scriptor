import type { CanvasBlock, CanvasDocument } from '@scriptor/core/contracts/canvas'

export interface CanvasCrdtOp {
  id: string
  peerId: string
  documentId: string
  timestamp: string
  blocks: CanvasBlock[]
  /** Per-peer monotonic counter; orders a peer's own ops within one millisecond. */
  seq?: number
  /** Ids tombstoned by this op. Absent on ops written by older builds. */
  deletedBlockIds?: string[]
}

export interface CanvasCrdtSyncState {
  enabled: boolean
  peerId: string
  lastSyncedAt: string | null
  pendingOps: number
  opCount: number
  /** Last persistence failure (for example localStorage quota), or null. */
  lastError: string | null
}

const STORAGE_PREFIX = 'scriptor.canvas.crdt.'
const MAX_STORED_OPS = 500

function storageKey(documentId: string): string {
  return `${STORAGE_PREFIX}${documentId}`
}

function readOps(documentId: string): CanvasCrdtOp[] {
  try {
    const raw = window.localStorage.getItem(storageKey(documentId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as CanvasCrdtOp[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

interface WriteResult {
  ops: CanvasCrdtOp[]
  error: string | null
}

/**
 * Persists the op log, truncated to the retention window. Never throws: storage
 * quota failures are returned so callers can surface them through sync state.
 */
function writeOps(documentId: string, ops: CanvasCrdtOp[]): WriteResult {
  const retained = ops.slice(-MAX_STORED_OPS)
  try {
    window.localStorage.setItem(storageKey(documentId), JSON.stringify(retained))
    return { ops: retained, error: null }
  } catch (error) {
    return {
      ops: retained,
      error: error instanceof Error ? error.message : 'canvas CRDT snapshot could not be persisted',
    }
  }
}

/**
 * Total order over ops. Wall-clock timestamps only have millisecond resolution,
 * so ties fall through to the peer id, that peer's monotonic sequence number and
 * finally the op id. Without those, replicas that observe the same ops in a
 * different order pick different winners and never converge.
 */
interface OpStamp {
  timestamp: string
  peerId: string
  seq: number
  opId: string
}

function stampOf(op: CanvasCrdtOp): OpStamp {
  return { timestamp: op.timestamp, peerId: op.peerId, seq: op.seq ?? 0, opId: op.id }
}

function compareStamps(left: OpStamp, right: OpStamp): number {
  if (left.timestamp !== right.timestamp) return left.timestamp < right.timestamp ? -1 : 1
  if (left.peerId !== right.peerId) return left.peerId < right.peerId ? -1 : 1
  if (left.seq !== right.seq) return left.seq < right.seq ? -1 : 1
  if (left.opId !== right.opId) return left.opId < right.opId ? -1 : 1
  return 0
}

function compareStrings(left: string, right: string): number {
  if (left === right) return 0
  return left < right ? -1 : 1
}

function mergeBlocks(ops: CanvasCrdtOp[]): CanvasBlock[] {
  const writes = new Map<string, { block: CanvasBlock; stamp: OpStamp }>()
  const tombstones = new Map<string, OpStamp>()

  for (const op of ops) {
    const stamp = stampOf(op)
    for (const block of op.blocks ?? []) {
      const existing = writes.get(block.id)
      if (!existing || compareStamps(existing.stamp, stamp) < 0) {
        writes.set(block.id, { block, stamp })
      }
    }
    for (const deletedId of op.deletedBlockIds ?? []) {
      const existing = tombstones.get(deletedId)
      if (!existing || compareStamps(existing, stamp) < 0) {
        tombstones.set(deletedId, stamp)
      }
    }
  }

  return Array.from(writes.entries())
    .filter(([blockId, entry]) => {
      const tombstone = tombstones.get(blockId)
      return !tombstone || compareStamps(tombstone, entry.stamp) < 0
    })
    .map(([, entry]) => entry.block)
    .sort((left, right) => left.zIndex - right.zIndex || compareStrings(left.id, right.id))
}

function lastOpForPeer(ops: CanvasCrdtOp[], peerId: string): CanvasCrdtOp | null {
  let latest: CanvasCrdtOp | null = null
  for (const op of ops) {
    if (op.peerId !== peerId) continue
    if (!latest || compareStamps(stampOf(latest), stampOf(op)) < 0) {
      latest = op
    }
  }
  return latest
}

/** LWW block-map CRDT with tombstoned deletes and cross-tab sync via localStorage. */
export class CanvasCrdtSync {
  private state: CanvasCrdtSyncState
  private readonly documentId: string
  private readonly listeners = new Set<(document: CanvasDocument) => void>()
  private seq = 0

  constructor(enabled: boolean, documentId: string, peerId = `peer-${crypto.randomUUID().slice(0, 8)}`) {
    this.documentId = documentId
    const hasWindow = typeof window !== 'undefined'
    this.state = {
      enabled,
      peerId,
      lastSyncedAt: null,
      pendingOps: 0,
      opCount: hasWindow ? readOps(documentId).length : 0,
      lastError: null,
    }
    if (enabled && hasWindow) {
      window.addEventListener('storage', this.onStorage)
    }
  }

  private onStorage = (event: StorageEvent) => {
    if (!this.state.enabled || this.listeners.size === 0) return
    if (event.key !== storageKey(this.documentId)) return
    const ops = readOps(this.documentId)
    const blocks = mergeBlocks(ops)
    const document: CanvasDocument = {
      id: this.documentId,
      vaultId: '',
      title: 'Synced board',
      mode: 'edgeless',
      layers: [
        { id: 'layer-main', name: 'Main', visible: true, locked: false, order: 0 },
      ],
      blocks,
      updatedAt: new Date().toISOString(),
    }
    for (const listener of Array.from(this.listeners)) {
      listener(document)
    }
  }

  isEnabled(): boolean {
    return this.state.enabled
  }

  subscribe(listener: (document: CanvasDocument) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  mergeRemote(document: CanvasDocument): CanvasDocument {
    if (!this.state.enabled) return document
    const ops = readOps(this.documentId)
    if (ops.length === 0) return document
    return {
      ...document,
      blocks: mergeBlocks([...ops, this.localOp(document.blocks, ops)]),
      updatedAt: new Date().toISOString(),
    }
  }

  /**
   * Builds the op for the current local state. Deletions are derived against
   * this peer's own previous op, so a peer only tombstones blocks it actually
   * published and never removes a concurrent remote insert it has not seen.
   */
  private localOp(blocks: CanvasBlock[], knownOps: CanvasCrdtOp[]): CanvasCrdtOp {
    const liveIds = new Set(blocks.map((block) => block.id))
    const previous = lastOpForPeer(knownOps, this.state.peerId)
    const deletedBlockIds = (previous?.blocks ?? [])
      .map((block) => block.id)
      .filter((blockId) => !liveIds.has(blockId))

    this.seq = Math.max(this.seq, (previous?.seq ?? 0)) + 1

    return {
      id: crypto.randomUUID(),
      peerId: this.state.peerId,
      documentId: this.documentId,
      timestamp: new Date().toISOString(),
      blocks,
      seq: this.seq,
      deletedBlockIds,
    }
  }

  snapshot(document: CanvasDocument): CanvasDocument {
    if (!this.state.enabled) return document
    const known = readOps(this.documentId)
    const op = this.localOp(document.blocks, known)
    const written = writeOps(this.documentId, [...known, op])
    this.state.opCount = written.ops.length
    this.state.lastError = written.error
    this.state.lastSyncedAt = op.timestamp
    return {
      ...document,
      blocks: mergeBlocks(written.ops),
      updatedAt: op.timestamp,
    }
  }

  markLocalEdit(): void {
    if (!this.state.enabled) return
    this.state.pendingOps += 1
  }

  flush(): CanvasCrdtSyncState {
    if (this.state.enabled && this.state.pendingOps > 0) {
      this.state.pendingOps = 0
    }
    return { ...this.state }
  }

  getState(): CanvasCrdtSyncState {
    return { ...this.state }
  }

  dispose(): void {
    this.listeners.clear()
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', this.onStorage)
    }
  }
}

/** Exported for validation tests: deterministic merge of an op log. */
export function mergeCrdtOps(ops: CanvasCrdtOp[]): CanvasBlock[] {
  return mergeBlocks(ops)
}
