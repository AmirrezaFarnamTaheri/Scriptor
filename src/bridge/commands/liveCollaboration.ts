import { invoke } from '@tauri-apps/api/core'
import { requireNative } from '../native.ts'
import { authorizeSensitiveOperation } from './authorization.ts'
import {
  parseLiveCollaborationEnvelope,
  parseLiveCollaborationScope,
  type LiveCollaborationScope,
} from '../../lib/liveCollaborationProtocol.ts'

/** An opt-in local outbox identity, not a connection to a collaboration relay. */
export interface NativeCollaborationDocument extends LiveCollaborationScope {
  notePath: string
}

export interface NativeCollaborationLease {
  sessionId: string
  baselineHash: string
  fileDiverged: boolean
  pendingCount: number
}

export async function collaborationLiveStart(
  scope: NativeCollaborationDocument,
): Promise<NativeCollaborationLease> {
  requireNative()
  parseLiveCollaborationScope(scope)
  if (typeof scope.notePath !== 'string' || !scope.notePath.endsWith('.md')
    || scope.notePath.length > 1024 || scope.notePath.startsWith('/')
    || scope.notePath.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error('Choose an existing vault-relative Markdown note before enabling collaboration')
  }
  const bound = ['live', scope.roomId, scope.documentId, scope.epoch, scope.notePath].join(':')
  const authorizationToken = await authorizeSensitiveOperation('live_collaboration_start', bound)
  const lease: NativeCollaborationLease = await invoke('collaboration_live_start', {
    request: {
      expectedVaultId: scope.vaultId,
      roomId: scope.roomId,
      documentId: scope.documentId,
      epoch: scope.epoch,
      peerId: scope.peerId,
      notePath: scope.notePath,
    },
    authorizationToken,
  })
  if (!lease || !/^[0-9a-f-]{36}$/i.test(lease.sessionId)
    || !/^[0-9a-f]{64}$/i.test(lease.baselineHash)
    || typeof lease.fileDiverged !== 'boolean'
    || !Number.isSafeInteger(lease.pendingCount) || lease.pendingCount < 0) {
    throw new Error('Native collaboration journal returned an invalid session receipt')
  }
  return lease
}

/** This resolves only after the native journal commits, not after a remote ACK. */
export async function collaborationLiveAppend(
  scope: NativeCollaborationDocument,
  sessionId: string,
  untrustedMessage: unknown,
): Promise<{ duplicate: boolean; locallyDurable: boolean }> {
  requireNative()
  const message = parseLiveCollaborationEnvelope(untrustedMessage, scope)
  if (message.kind !== 'LOCAL_UPDATE' || !message.payload) {
    throw new Error('Only locally authored updates can enter the native journal')
  }
  const receipt: { duplicate: boolean; locallyDurable: boolean } = await invoke('collaboration_live_append', {
    expectedVaultId: scope.vaultId,
    sessionId,
    messageId: message.messageId,
    clientSeq: message.clientSeq,
    payload: message.payload,
  })
  if (!receipt || receipt.locallyDurable !== true || typeof receipt.duplicate !== 'boolean') {
    throw new Error('Native journal did not acknowledge a durable local write')
  }
  return receipt
}

export interface NativePendingUpdate {
  messageId: string
  clientSeq: number
  payload: string
}

export async function collaborationLivePending(
  expectedVaultId: string,
  sessionId: string,
  afterSequence = 0,
): Promise<NativePendingUpdate[]> {
  requireNative()
  if (!Number.isSafeInteger(afterSequence) || afterSequence < 0) {
    throw new Error('Invalid collaboration recovery cursor')
  }
  const pending: unknown = await invoke('collaboration_live_pending', {
    expectedVaultId,
    sessionId,
    afterSequence,
  })
  if (!Array.isArray(pending) || pending.length > 64) {
    throw new Error('Invalid native collaboration recovery page')
  }
  return pending.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      throw new Error('Malformed native journal update')
    }
    const item = entry as Record<string, unknown>
    if (typeof item.messageId !== 'string' || !/^[A-Za-z0-9_-]{1,160}$/.test(item.messageId)
      || !Number.isSafeInteger(item.clientSeq) || (item.clientSeq as number) < 1
      || typeof item.payload !== 'string' || item.payload.length > 350000) {
      throw new Error('Malformed native collaboration recovery data')
    }
    return {
      messageId: item.messageId,
      clientSeq: item.clientSeq as number,
      payload: item.payload,
    }
  })
}

/** Closes the ephemeral permission lease. Persisted updates are not deleted. */
export async function collaborationLiveStop(
  expectedVaultId: string,
  sessionId: string,
): Promise<boolean> {
  requireNative()
  return invoke<boolean>('collaboration_live_stop', { expectedVaultId, sessionId })
}
