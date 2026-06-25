import type { CanvasBlock, CanvasDocument } from '@scriptor/core/contracts/canvas'

export interface CanvasCrdtOp {
  id: string
  peerId: string
  documentId: string
  timestamp: string
  blocks: CanvasBlock[]
}

export interface CanvasCrdtSyncState {
  enabled: boolean
  peerId: string
  lastSyncedAt: string | null
  pendingOps: number
  opCount: number
}

const STORAGE_PREFIX = 'scriptor.canvas.crdt.'

function storageKey(documentId: string): string {
  return `${STORAGE_PREFIX}${documentId}`
}

function readOps(documentId: string): CanvasCrdtOp[] {
  try {
    const raw = window.localStorage.getItem(storageKey(documentId))
    if (!raw) return []
    return JSON.parse(raw) as CanvasCrdtOp[]
  } catch {
    return []
  }
}

function writeOps(documentId: string, ops: CanvasCrdtOp[]): void {
  window.localStorage.setItem(storageKey(documentId), JSON.stringify(ops.slice(-500)))
}

function mergeBlocks(ops: CanvasCrdtOp[]): CanvasBlock[] {
  const byId = new Map<string, { block: CanvasBlock; timestamp: string }>()
  for (const op of ops) {
    for (const block of op.blocks) {
      const existing = byId.get(block.id)
      if (!existing || existing.timestamp <= op.timestamp) {
        byId.set(block.id, { block, timestamp: op.timestamp })
      }
    }
  }
  return Array.from(byId.values())
    .map((entry) => entry.block)
    .sort((left, right) => left.zIndex - right.zIndex)
}

/** LWW block-map CRDT with cross-tab sync via localStorage. */
export class CanvasCrdtSync {
  private state: CanvasCrdtSyncState
  private readonly documentId: string
  private listener: ((document: CanvasDocument) => void) | null = null

  constructor(enabled: boolean, documentId: string, peerId = `peer-${crypto.randomUUID().slice(0, 8)}`) {
    this.documentId = documentId
    this.state = {
      enabled,
      peerId,
      lastSyncedAt: null,
      pendingOps: 0,
      opCount: readOps(documentId).length,
    }
    if (enabled && typeof window !== 'undefined') {
      window.addEventListener('storage', this.onStorage)
    }
  }

  private onStorage = (event: StorageEvent) => {
    if (!this.state.enabled || !this.listener || event.key !== storageKey(this.documentId)) return
    const ops = readOps(this.documentId)
    const blocks = mergeBlocks(ops)
    this.listener({
      id: this.documentId,
      vaultId: '',
      title: 'Synced board',
      mode: 'edgeless',
      layers: [
        { id: 'layer-main', name: 'Main', visible: true, locked: false, order: 0 },
      ],
      blocks,
      updatedAt: new Date().toISOString(),
    })
  }

  isEnabled(): boolean {
    return this.state.enabled
  }

  subscribe(listener: (document: CanvasDocument) => void): () => void {
    this.listener = listener
    return () => {
      this.listener = null
    }
  }

  mergeRemote(document: CanvasDocument): CanvasDocument {
    if (!this.state.enabled) return document
    const ops = readOps(this.documentId)
    if (ops.length === 0) return document
    return {
      ...document,
      blocks: mergeBlocks([...ops, this.localOp(document.blocks)]),
      updatedAt: new Date().toISOString(),
    }
  }

  private localOp(blocks: CanvasBlock[]): CanvasCrdtOp {
    return {
      id: crypto.randomUUID(),
      peerId: this.state.peerId,
      documentId: this.documentId,
      timestamp: new Date().toISOString(),
      blocks,
    }
  }

  snapshot(document: CanvasDocument): CanvasDocument {
    if (!this.state.enabled) return document
    const op = this.localOp(document.blocks)
    const ops = [...readOps(this.documentId), op]
    writeOps(this.documentId, ops)
    this.state.opCount = ops.length
    this.state.lastSyncedAt = op.timestamp
    return {
      ...document,
      blocks: mergeBlocks(ops),
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
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', this.onStorage)
    }
  }
}
