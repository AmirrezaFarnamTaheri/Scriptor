import { OperationGuard } from './operation-guard.ts'
import type { GitStatus } from '../types/vault'

/**
 * Framework-free owner of Git status freshness.
 *
 * Status results are stored in per-vault slots instead of one shared value:
 * a response that lands after the active vault changed can never leak into
 * another vault's panel, and an open-flow fetch issued before the vault state
 * commit lands is never discarded. The guard still sequences refreshes so the
 * newest request for a vault supersedes older ones.
 */

/** Bounded number of vaults whose last status stays resident. */
export const GIT_STATUS_MAX_VAULT_SLOTS = 3

const NO_VAULT_KEY = '\u0000no-vault'

export function vaultStatusKey(vaultId: string | null): string {
  return vaultId === null ? NO_VAULT_KEY : vaultId
}

export interface GitVaultSlot {
  status: GitStatus | null
  error: string | null
}

export interface GitStatusSnapshot {
  slots: Readonly<Record<string, GitVaultSlot>>
  isLoading: boolean
}

type StatusFetcher = () => Promise<GitStatus>
type StatusErrorHandler = (detail: string) => void

export class WorkspaceGitStatusController {
  private slots: Record<string, GitVaultSlot> = {}
  private snapshot: GitStatusSnapshot = { slots: {}, isLoading: false }
  private readonly guard = new OperationGuard()
  private readonly listeners = new Set<() => void>()
  private currentKey = NO_VAULT_KEY

  private fetchStatus: StatusFetcher
  private onStatusError: StatusErrorHandler | undefined

  constructor(fetchStatus: StatusFetcher, onStatusError?: StatusErrorHandler) {
    this.fetchStatus = fetchStatus
    this.onStatusError = onStatusError
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = (): GitStatusSnapshot => this.snapshot

  /** Replace the status-failure reporter without rebuilding the controller. */
  setStatusErrorHandler(handler: StatusErrorHandler | undefined): void {
    this.onStatusError = handler
  }

  /** Track the active vault so reads and default refresh targets stay scoped. */
  setActiveVault(vaultId: string | null): void {
    const key = vaultStatusKey(vaultId)
    if (key === this.currentKey) return
    this.currentKey = key
    this.emit()
  }

  /**
   * Refresh Git status. Without arguments the active vault is targeted;
   * callers that know the vault identity explicitly (the vault-open flow)
   * pass it so result placement never depends on render timing.
   */
  async refresh(explicitVaultId?: string | null): Promise<void> {
    const targetKey =
      explicitVaultId === undefined ? this.currentKey : vaultStatusKey(explicitVaultId)
    const ticket = this.guard.issue()
    this.setLoading(true)
    try {
      const status = await this.fetchStatus()
      if (!this.guard.isCurrent(ticket)) return
      this.write(targetKey, { status, error: null })
    } catch (caught) {
      if (!this.guard.isCurrent(ticket)) return
      const detail = caught instanceof Error ? caught.message : String(caught)
      console.error('useWorkspaceGit: gitStatus error', caught)
      this.onStatusError?.(detail)
      const previous = this.slots[targetKey]
      this.write(targetKey, { status: previous?.status ?? null, error: detail })
    } finally {
      if (this.guard.isCurrent(ticket)) this.setLoading(false)
    }
  }

  getStatus(vaultId: string | null): GitStatus | null {
    return this.slots[vaultStatusKey(vaultId)]?.status ?? null
  }

  getError(vaultId: string | null): string | null {
    return this.slots[vaultStatusKey(vaultId)]?.error ?? null
  }

  private write(key: string, slot: GitVaultSlot): void {
    const nextSlots: Record<string, GitVaultSlot> = { ...this.slots, [key]: slot }
    let overflow = Object.keys(nextSlots).length - GIT_STATUS_MAX_VAULT_SLOTS
    for (const existing of Object.keys(nextSlots)) {
      if (overflow <= 0) break
      if (existing === key || existing === this.currentKey) continue
      delete nextSlots[existing]
      overflow -= 1
    }
    this.slots = nextSlots
    this.snapshot = { slots: { ...nextSlots }, isLoading: this.snapshot.isLoading }
    this.emit()
  }

  private setLoading(value: boolean): void {
    if (this.snapshot.isLoading === value) return
    this.snapshot = { ...this.snapshot, isLoading: value }
    this.emit()
  }

  private emit(): void {
    for (const listener of this.listeners) listener()
  }
}
