import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { DurableCollaborationSession, DurableLocalJournalPort } from '../../lib/liveCollaborationDurableSession.ts'
import { RecoverableCanonicalProjection } from '../../lib/liveCollaborationProjection.ts'
import type { LiveNoteSaveLease } from '../../hooks/useWorkspaceEditor.ts'
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

/**
 * Single-owner native projection. The native command retains Scriptor's
 * write-lock/CAS/backup/history protections and updates its own durable
 * baseline only after the file has been written. A caller MUST NOT use this
 * while the normal autosave engine owns the note.
 */
export async function collaborationLiveProject(
  scope: NativeCollaborationDocument,
  sessionId: string,
  markdown: string,
  expectedContentHash: string,
): Promise<unknown> {
  requireNative()
  parseLiveCollaborationScope(scope)
  if (typeof markdown !== 'string' ||
      new TextEncoder().encode(markdown).byteLength > 2 * 1024 * 1024 ||
      typeof expectedContentHash !== 'string' ||
      !/^[a-f0-9]{64}$/i.test(expectedContentHash)) {
    throw new Error('Invalid collaboration projection or content revision')
  }
  return invoke('collaboration_live_project', {
    expectedVaultId: scope.vaultId,
    sessionId,
    markdown,
    expectedContentHash,
  })
}

/**
 * Opt-in automatic canonical file projection. The caller MUST first obtain
 * LiveNoteSaveLease from the real workspace save controller, start the native
 * lease, mark native ownership, hydrate the CRDT from authenticated relay
 * history, and restore the local WAL journal. No default app activation is
 * performed here; failed projection leaves that native lease and draft locked.
 */
export function attachNativeCanonicalProjection(
  scope: NativeCollaborationDocument,
  nativeLease: NativeCollaborationLease,
  owner: LiveNoteSaveLease,
  session: DurableCollaborationSession,
  onError: (error: Error) => void,
): RecoverableCanonicalProjection {
  requireNative()
  if (!session.ready || nativeLease.fileDiverged ||
    nativeLease.baselineHash !== owner.baselineHash ||
    owner.vaultId !== scope.vaultId || owner.path !== scope.notePath ||
    !/^[0-9a-f-]{36}$/i.test(nativeLease.sessionId)) {
    throw new Error('Native projection requires the same verified, recovered note and save owner')
  }
  const controller = new RecoverableCanonicalProjection({
    source: session,
    scope: { vaultId: scope.vaultId, notePath: scope.notePath },
    baseline: { markdown: owner.markdown, contentHash: nativeLease.baselineHash },
    project: (markdown, hash) => collaborationLiveProject(scope, nativeLease.sessionId, markdown, hash),
    updateDraft: markdown => { owner.receiveCanonicalText(markdown) },
    onError,
  })
  controller.start()
  return controller
}

/** Closes the ephemeral permission lease. Persisted updates are not deleted. */
export async function collaborationLiveStop(
  expectedVaultId: string,
  sessionId: string,
): Promise<boolean> {
  requireNative()
  return invoke<boolean>('collaboration_live_stop', { expectedVaultId, sessionId })
}


/**
 * Native journal port for a previously consented collaboration document.
 * This adapter cannot remove/acknowledge stored updates. The future authenticated
 * native relay transport, not renderer-provided flags, must own durable ACKs.
 */
export function nativeLiveCollaborationJournalPort(): DurableLocalJournalPort {
  return {
    append: collaborationLiveAppend,
    pending: (scope, sessionId, afterSequence) =>
      collaborationLivePending(scope.vaultId, sessionId, afterSequence),
    stop: async (scope, sessionId) => {
      await collaborationLiveStop(scope.vaultId, sessionId)
    },
  }
}

/** Returns only the public Ed25519 registration key for a currently approved
 * native document lease. The private signing key never enters the JS runtime. */
export async function collaborationLivePublicKey(
  expectedVaultId: string,
  sessionId: string,
): Promise<string> {
  requireNative()
  const pem: unknown = await invoke('collaboration_live_public_key', {
    expectedVaultId, sessionId,
  })
  if (typeof pem !== 'string' || !/^-----BEGIN PUBLIC KEY-----\n[A-Za-z0-9+/=\n]+\n-----END PUBLIC KEY-----\n$/.test(pem)) {
    throw new Error('Native collaboration identity returned an invalid public key')
  }
  return pem
}

export interface NativeRelayConnectReceipt {
  sessionId: string
  role: 'owner' | 'editor' | 'viewer'
}

export interface AuthenticatedNativeRelayEvent {
  sessionId: string
  roomId: string
  documentId: string
  epoch: number
  kind: 'connected' | 'remote_available' | 'remote_update' | 'ack' | 'error' | 'disconnected'
  peerId?: string
  messageId?: string
  clientSeq?: number
  cursor?: number
  payload?: string
  role?: 'owner' | 'editor' | 'viewer'
  ticket?: string
}

function validatedRelayEndpoint(endpoint: string): string {
  if (typeof endpoint !== 'string' || endpoint.length > 2048) {
    throw new Error('Invalid collaboration WSS endpoint')
  }
  let url: URL
  try {
    url = new URL(endpoint)
  } catch {
    throw new Error('Invalid collaboration WSS endpoint')
  }
  if (url.protocol !== 'wss:' || !url.hostname ||
    url.username || url.password || url.search || url.hash ||
    url.pathname !== '/v1/live') {
    throw new Error('Collaboration relay must be a trusted wss:// endpoint')
  }
  return endpoint
}

export async function collaborationLiveConnect(
  scope: NativeCollaborationDocument,
  sessionId: string,
  endpoint: string,
): Promise<NativeRelayConnectReceipt> {
  requireNative()
  parseLiveCollaborationScope(scope)
  const endpointUrl = validatedRelayEndpoint(endpoint)
  const bound = ['live-remote', scope.roomId, scope.documentId, scope.epoch, scope.notePath, endpointUrl].join(':')
  const authorizationToken = await authorizeSensitiveOperation('live_collaboration_connect', bound)
  const receipt: unknown = await invoke('collaboration_live_connect', {
    expectedVaultId: scope.vaultId, sessionId, endpointUrl, authorizationToken,
  })
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
    throw new Error('Native relay did not confirm authenticated membership')
  }
  const value = receipt as Record<string, unknown>
  if (value.sessionId !== sessionId ||
      !['owner', 'editor', 'viewer'].includes(String(value.role))) {
    throw new Error('Native relay returned an invalid authorization role')
  }
  return { sessionId, role: value.role as NativeRelayConnectReceipt['role'] }
}

export async function collaborationLiveDisconnect(
  scope: NativeCollaborationDocument,
  sessionId: string,
): Promise<boolean> {
  requireNative()
  return invoke<boolean>('collaboration_live_disconnect', {
    expectedVaultId: scope.vaultId, sessionId,
  })
}

const NATIVE_RELAY_EVENT = 'scriptor:collaboration:relay'
const CANONICAL_RELAY_BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/

/**
 * Consume only native transport events tied to the active approved local lease.
 * The Rust worker has already verified TLS, challenge proof, role, and relay
 * update metadata. Never deserialize untrusted peer messages directly into
 * the coordinator without this native boundary.
 */
export async function listenToNativeCollaborationRelay(
  scope: NativeCollaborationDocument,
  sessionId: string,
  session: DurableCollaborationSession,
  onError: (error: Error) => void,
): Promise<() => void> {
  requireNative()
  parseLiveCollaborationScope(scope)
  let disposed = false
  const stopListening = await listen<AuthenticatedNativeRelayEvent>(NATIVE_RELAY_EVENT, event => {
    const notice = event.payload
    if (disposed || !notice || notice.sessionId !== sessionId ||
      notice.roomId !== scope.roomId ||
      notice.documentId !== scope.documentId ||
      notice.epoch !== scope.epoch) return
    if (notice.kind === 'error') {
      onError(new Error('Authenticated relay disconnected; unsent updates remain in native journal'))
      return
    }
    // Never accept note bytes from a renderer-visible event: Tauri events can
    // also be emitted by UI code. Only the native WSS worker may create a
    // one-time ticket for content it has actually authenticated.
    if (notice.kind !== 'remote_available') return
    void (async () => {
      if (typeof notice.ticket !== 'string' || !/^[0-9a-f-]{36}$/i.test(notice.ticket)) {
        throw new Error('Missing authenticated native relay ticket')
      }
      const raw: unknown = await invoke('collaboration_live_take_remote', {
        expectedVaultId: scope.vaultId,
        sessionId,
        ticket: notice.ticket,
      })
      if (disposed) return
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new Error('Native relay did not return a validated remote update')
      }
      const message = raw as AuthenticatedNativeRelayEvent
      if (message.kind !== 'remote_update' ||
        message.sessionId !== sessionId ||
        message.roomId !== scope.roomId ||
        message.documentId !== scope.documentId ||
        message.epoch !== scope.epoch) {
        throw new Error('Native relay update crossed the approved room or document')
      }
      const { peerId, messageId, clientSeq, payload } = message
      if (typeof peerId !== 'string' || typeof messageId !== 'string' ||
        !Number.isSafeInteger(clientSeq) || (clientSeq as number) <= 0 ||
        typeof payload !== 'string' || payload.length > 350000 ||
        !CANONICAL_RELAY_BASE64.test(payload)) {
        throw new Error('Malformed native relay update response')
      }
      parseLiveCollaborationEnvelope({
        version: 1, kind: 'LOCAL_UPDATE',
        ...scope, peerId, messageId, clientSeq, payload,
      }, { ...scope, peerId })
      const binary = atob(payload)
      if (!binary || binary.length > 256 * 1024) {
        throw new Error('Invalid authenticated relay update size')
      }
      const decoded = Uint8Array.from(binary, character => character.charCodeAt(0))
      session.receiveRemote(decoded, {
        roomId: scope.roomId, documentId: scope.documentId,
        epoch: scope.epoch, peerId,
      })
    })().catch(error => {
      if (!disposed) onError(error instanceof Error ? error : new Error('Native relay verification failed'))
    })
  })
  return () => {
    disposed = true
    stopListening()
  }
}
