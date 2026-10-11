// Reviewed repair payloads are data only. Native repair commands must independently
// recompute changes, validate vault identity and authorize any future mutation.
export type HealthRepairRequest = { kind: 'create_note' | 'normalize_tags' | 'prune_asset'; path: string }
export interface HealthRepairPlan {
  vault_id: string
  request: HealthRepairRequest
  fingerprint: string
  changes: { path: string; expected_hash: string; before: string; after: string; bytes: number }[]
  scan?: { complete: true; notes: number; fingerprint: string }
}
export interface HealthRepairReceipt { id: string; vault_id: string; path: string; hash: string; bytes: number; after_hash?: string; kind?: HealthRepairRequest['kind'] }

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid repair payload.')
  return value as Record<string, unknown>
}
function boundedString(value: unknown, limit = 4096): string {
  if (typeof value !== 'string' || !value || value.length > limit || /[\u0000-\u001f]/.test(value)) throw new Error('Invalid repair field.')
  return value
}
function vaultPath(value: unknown): string {
  const path = boundedString(value)
  if (/[:\\#|?*<>"%]/.test(path) || path.startsWith('/') || path.split('/').some(part => !part || part === '.' || part === '..' || part.startsWith('.') || /[. ]$/.test(part) || /^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(part))) throw new Error('Invalid repair path.')
  return path
}
function hash(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) throw new Error('Invalid repair fingerprint.')
  return value
}
export function missingNoteSuggestion(message: string): string | null {
  const prefix = 'unresolved link target: '
  if (!message.startsWith(prefix)) return null
  try {
    const target = vaultPath(message.slice(prefix.length).trim())
    if (target.endsWith('.md')) return target
    if (/\.[^/]+$/.test(target)) return null
    return `${target}.md`
  } catch { return null }
}
export function parseHealthRepairPlan(payload: unknown): HealthRepairPlan {
  const row = record(payload), request = record(row.request)
  if (request.kind !== 'create_note' && request.kind !== 'normalize_tags' && request.kind !== 'prune_asset') throw new Error('Unsupported repair request.')
  const path = vaultPath(request.path)
  if ((request.kind !== 'prune_asset' && !path.endsWith('.md')) || !Array.isArray(row.changes) || row.changes.length !== 1) throw new Error('Invalid repair scope.')
  const change = record(row.changes[0])
  if (vaultPath(change.path) !== path || typeof change.before !== 'string' || typeof change.after !== 'string') throw new Error('Invalid repair change.')
  let scan: HealthRepairPlan['scan']
  const expectedHash = request.kind === 'create_note' ? '<missing>' : hash(change.expected_hash)
  if (request.kind === 'create_note' && (change.expected_hash !== '<missing>' || change.before !== '' || !change.after)) throw new Error('Invalid note creation.')
  if (request.kind === 'normalize_tags' && (change.before === change.after || !change.before || !change.after)) throw new Error('Invalid tag normalization.')
  if (request.kind === 'prune_asset') {
    const proof = record(row.scan)
    if (proof.complete !== true || !Number.isSafeInteger(proof.notes) || (proof.notes as number) < 0 || (proof.notes as number) > 250_000 || change.before !== '' || change.after !== '' || path.endsWith('.md')) throw new Error('A complete reference scan is required before pruning.')
    scan = { complete: true, notes: proof.notes as number, fingerprint: hash(proof.fingerprint) }
  }
  const bytes = request.kind === 'prune_asset' ? change.bytes : new TextEncoder().encode(change.after).byteLength
  if (typeof bytes !== 'number' || !Number.isSafeInteger(bytes) || bytes < 0 || bytes > (request.kind === 'prune_asset' ? 64 : 2) * 1024 * 1024 || bytes !== change.bytes || new TextEncoder().encode(change.before).byteLength > 2 * 1024 * 1024) throw new Error('Invalid repair content bound.')
  return { vault_id: boundedString(row.vault_id), request: { kind: request.kind, path }, fingerprint: hash(row.fingerprint), changes: [{ path, expected_hash: expectedHash, before: change.before, after: change.after, bytes }], ...(scan ? { scan } : {}) }
}
export function parseHealthRepairReceipt(payload: unknown): HealthRepairReceipt {
  const row = record(payload)
  if (typeof row.id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(row.id) || typeof row.bytes !== 'number' || !Number.isSafeInteger(row.bytes) || row.bytes < 0 || row.bytes > 64 * 1024 * 1024) throw new Error('Invalid recovery receipt.')
  if (row.kind !== undefined && row.kind !== 'create_note' && row.kind !== 'normalize_tags' && row.kind !== 'prune_asset') throw new Error('Invalid recovery operation.')
  if ((row.kind === undefined) !== (row.after_hash === undefined)) throw new Error('Incomplete recovery source verification.')
  const afterHash = row.after_hash === undefined ? undefined : row.after_hash === '<missing>' && row.kind === 'prune_asset' ? '<missing>' : hash(row.after_hash)
  return { id: row.id, vault_id: boundedString(row.vault_id), path: vaultPath(row.path), hash: hash(row.hash), bytes: row.bytes, ...(afterHash ? { after_hash: afterHash, kind: row.kind as HealthRepairRequest['kind'] } : {}) }
}
