/** Wire validation for opt-in collaboration; native code remains the authority. */
export const LIVE_COLLABORATION_PROTOCOL_VERSION = 1 as const
export const MAX_LIVE_UPDATE_BYTES = 256 * 1024
export const MAX_LIVE_AWARENESS_BYTES = 2 * 1024
export const MAX_LIVE_DOCUMENT_BYTES = 2 * 1024 * 1024
export const MAX_LIVE_PENDING_BYTES = 64 * 1024 * 1024

export interface LiveCollaborationScope {
  vaultId: string
  roomId: string
  documentId: string
  epoch: number
  peerId: string
}
export type LiveCollaborationKind = 'LOCAL_UPDATE' | 'SYNC_UPDATE' | 'SYNC_VECTOR' | 'DURABLE_ACK' | 'AWARENESS'
export interface LiveCollaborationEnvelope extends LiveCollaborationScope {
  version: typeof LIVE_COLLABORATION_PROTOCOL_VERSION
  kind: LiveCollaborationKind
  messageId: string
  clientSeq: number
  payload?: string
}

const IDENTIFIER = /^[a-zA-Z0-9_-]{1,160}$/
const SCOPE_KEYS = ['vaultId', 'roomId', 'documentId', 'epoch', 'peerId'] as const
const ENVELOPE_KEYS = new Set<string>(['version', 'kind', 'messageId', 'clientSeq', 'payload', ...SCOPE_KEYS])
const PAYLOAD_KINDS: ReadonlySet<string> = new Set(['LOCAL_UPDATE', 'SYNC_UPDATE', 'SYNC_VECTOR', 'AWARENESS'])
const KINDS: ReadonlySet<string> = new Set([...PAYLOAD_KINDS, 'DURABLE_ACK'])

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Invalid ${label}`)
  return value as Record<string, unknown>
}
function validId(value: unknown): value is string {
  return typeof value === 'string' && IDENTIFIER.test(value)
}
function validSeq(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}
function validBase64(encoded: string, maxBytes: number): boolean {
  if (encoded.length === 0 || encoded.length > Math.ceil(maxBytes / 3) * 4) return false
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) return false
  const decodedBytes = encoded.length / 4 * 3 - (encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0)
  return decodedBytes > 0 && decodedBytes <= maxBytes
}

export function parseLiveCollaborationScope(value: unknown): LiveCollaborationScope {
  const item = object(value, 'collaboration scope')
  if (!validId(item.vaultId) || !validId(item.roomId) || !validId(item.documentId) || !validId(item.peerId) ||
    !Number.isSafeInteger(item.epoch) || (item.epoch as number) < 1) throw new Error('Invalid collaboration scope')
  return { vaultId: item.vaultId, roomId: item.roomId, documentId: item.documentId, epoch: item.epoch as number, peerId: item.peerId }
}

/** Reject unknown fields and bind a wire message to its originating session. */
export function parseLiveCollaborationEnvelope(value: unknown, expected: LiveCollaborationScope): LiveCollaborationEnvelope {
  const item = object(value, 'collaboration envelope')
  if (Object.keys(item).some(key => !ENVELOPE_KEYS.has(key))) throw new Error('Unknown collaboration envelope field')
  const scope = parseLiveCollaborationScope(item)
  if (SCOPE_KEYS.some(key => scope[key] !== expected[key])) throw new Error('Collaboration scope mismatch')
  if (item.version !== LIVE_COLLABORATION_PROTOCOL_VERSION || typeof item.kind !== 'string' || !KINDS.has(item.kind) ||
    !validId(item.messageId) || !validSeq(item.clientSeq)) throw new Error('Invalid collaboration envelope')
  const kind = item.kind as LiveCollaborationKind
  if (PAYLOAD_KINDS.has(kind)) {
    const max = kind === 'AWARENESS' ? MAX_LIVE_AWARENESS_BYTES : MAX_LIVE_UPDATE_BYTES
    if (typeof item.payload !== 'string' || !validBase64(item.payload, max)) throw new Error('Invalid collaboration payload or size limit')
  } else if (item.payload !== undefined) throw new Error('Acknowledgement cannot carry a payload')
  return { ...scope, version: LIVE_COLLABORATION_PROTOCOL_VERSION, kind, messageId: item.messageId, clientSeq: item.clientSeq,
    ...(item.payload === undefined ? {} : { payload: item.payload as string }) }
}

export type LiveCollaborationRole = 'owner' | 'editor' | 'viewer' | 'revoked'
export function assertLiveCollaborationPermission(role: LiveCollaborationRole, kind: LiveCollaborationKind): void {
  if (role === 'revoked' || (role === 'viewer' && kind === 'LOCAL_UPDATE')) throw new Error('Collaboration operation not permitted')
}
