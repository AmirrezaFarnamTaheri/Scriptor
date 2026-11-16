/**
 * One-canonical-writer, opt-in file projection scheduler. Does not grant a
 * collaboration lease or expose a production activation path. The caller must
 * already own the native projection lock and suspend all ordinary save writers.
 */
export interface CanonicalProjectionSource {
  readonly value: string
  subscribe(listener: (markdown: string) => void): () => void
}

export interface CanonicalProjectionScope {
  vaultId: string
  notePath: string
}

export type NativeProjectionCommand = (
  markdown: string,
  expectedContentHash: string,
) => Promise<unknown>

export interface CanonicalProjectionOptions {
  source: CanonicalProjectionSource
  scope: CanonicalProjectionScope
  baseline: { markdown: string; contentHash: string }
  project: NativeProjectionCommand
  updateDraft: (markdown: string) => void | Promise<void>
  onError: (error: Error) => void
}

const HASH = /^[a-f0-9]{64}$/i
const MAX_DOCUMENT_BYTES = 2 * 1024 * 1024
const bytes = new TextEncoder()

function expectedReceipt(value: unknown, scope: CanonicalProjectionScope, previousHash: string): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Native collaboration projection receipt is missing')
  }
  const metadata = (value as Record<string, unknown>).metadata
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new Error('Native collaboration projection receipt has no document metadata')
  }
  const receipt = metadata as Record<string, unknown>
  if (receipt.vault_id !== scope.vaultId || receipt.path !== scope.notePath ||
    typeof receipt.content_hash !== 'string' || !HASH.test(receipt.content_hash) ||
    receipt.content_hash === previousHash) {
    throw new Error('Native projection has not confirmed a new scoped content revision')
  }
  return receipt.content_hash
}

/**
 * Commits each exact canonical text revision through the existing native CAS,
 * backup, history, and WAL-baseline transaction. If the native result is
 * ambiguous, retry the SAME text/hash first, never jump to a newer revision.
 * Failure never releases the native lock or clears source content.
 */
export class RecoverableCanonicalProjection {
  private readonly opts: CanonicalProjectionOptions
  private persisted: string
  private hash: string
  private desired: string
  private retryText: string | null = null
  private processing: Promise<void> | null = null
  private failure: Error | null = null
  private unsubscribe: (() => void) | null = null
  private disposed = false

  constructor(opts: CanonicalProjectionOptions) {
    if (!opts?.source || !opts.scope?.vaultId || !opts.scope?.notePath?.endsWith('.md') ||
      typeof opts.baseline?.markdown !== 'string' || !HASH.test(opts.baseline?.contentHash ?? '') ||
      typeof opts.project !== 'function' || typeof opts.updateDraft !== 'function' ||
      typeof opts.onError !== 'function') {
      throw new Error('A verified vault note, CAS baseline and native projection command are required')
    }
    this.opts = opts
    this.persisted = opts.baseline.markdown
    this.desired = opts.baseline.markdown
    this.hash = opts.baseline.contentHash
  }

  get projectedHash(): string { return this.hash }
  get projectedMarkdown(): string { return this.persisted }
  get blocked(): boolean { return this.failure !== null }
  get hasUnprojectedChanges(): boolean {
    return this.retryText !== null || this.desired !== this.persisted || this.processing !== null
  }

  /** Attach only after native approval, authenticated hydration and journal recovery. */
  start(): void {
    if (this.disposed || this.unsubscribe) throw new Error('Projection has already started or stopped')
    this.unsubscribe = this.opts.source.subscribe(markdown => {
      // Subscribers run during durable journal commits; never throw out of this callback.
      this.observe(markdown)
    })
    this.observe(this.opts.source.value)
  }

  private observe(markdown: string): void {
    if (this.disposed) return
    this.desired = markdown
    this.kick()
  }

  private fail(error: unknown): void {
    this.failure = error instanceof Error ? error : new Error('Native collaboration projection failed')
    try { this.opts.onError(this.failure) } catch { /* Do not unwind a durable journal receipt. */ }
  }

  private kick(): void {
    if (this.disposed || this.failure || this.processing ||
      (this.retryText === null && this.desired === this.persisted)) return
    this.processing = Promise.resolve().then(async () => {
      while (!this.failure && !this.disposed) {
        const exact = this.retryText ?? this.desired
        if (this.retryText === null && exact === this.persisted) return
        if (typeof exact !== 'string' || bytes.encode(exact).byteLength > MAX_DOCUMENT_BYTES) {
          throw new Error('Canonical collaboration document exceeds the 2 MiB projection bound')
        }
        // On an ambiguous result this marker is intentionally kept for replay.
        this.retryText = exact
        await this.opts.updateDraft(exact)
        const next = expectedReceipt(await this.opts.project(exact, this.hash), this.opts.scope, this.hash)
        this.persisted = exact
        this.hash = next
        this.retryText = null
      }
    }).catch(error => { this.fail(error) }).finally(() => {
      this.processing = null
      if (!this.disposed && !this.failure && this.desired !== this.persisted) this.kick()
    })
  }

  /** Explicit safe retry after disk/network ambiguity or a reported CAS conflict. */
  async retry(): Promise<void> {
    if (this.disposed || !this.unsubscribe) throw new Error('Projection is not active')
    this.failure = null
    this.kick()
    await this.waitUntilProjected()
  }

  /** A native lease may be released only after this and exact disk verification. */
  async waitUntilProjected(): Promise<void> {
    if (this.disposed || !this.unsubscribe) throw new Error('Projection is not active')
    while (true) {
      if (this.failure) throw this.failure
      if (!this.processing && this.retryText === null && this.desired === this.persisted) return
      this.kick()
      if (!this.processing) throw new Error('Canonical projection is blocked or did not start')
      await this.processing
    }
  }

  /** Disposing cannot release a native lease or erase an unprojected CRDT. */
  dispose(): void {
    this.disposed = true
    this.unsubscribe?.()
    this.unsubscribe = null
  }
}
