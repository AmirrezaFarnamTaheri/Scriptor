// Reviewed repair payloads are data only. Native repair commands must independently
// recompute changes, validate vault identity and authorize any future mutation.
export interface HealthRepairPlan {
  vault_id: string
  request: { kind: 'create_note'; path: string }
  fingerprint: string
  changes: { path: string; expected_hash: string; before: string; after: string; bytes: number }[]
}
export interface HealthRepairReceipt { id: string; vault_id: string; path: string; hash: string; bytes: number }

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
  if (request.kind !== 'create_note') throw new Error('Unsupported repair request.')
  const path = vaultPath(request.path)
  if (!path.endsWith('.md') || !Array.isArray(row.changes) || row.changes.length !== 1) throw new Error('Invalid note repair.')
  const change = record(row.changes[0])
  if (vaultPath(change.path) !== path || change.expected_hash !== '<missing>' || change.before !== '' || typeof change.after !== 'string' || !change.after) throw new Error('Invalid note repair change.')
  const bytes = new TextEncoder().encode(change.after).byteLength
  if (bytes > 2 * 1024 * 1024 || bytes !== change.bytes) throw new Error('Invalid repair content bound.')
  return { vault_id: boundedString(row.vault_id), request: { kind: 'create_note', path }, fingerprint: hash(row.fingerprint), changes: [{ path, expected_hash: '<missing>', before: '', after: change.after, bytes }] }
}
export function parseHealthRepairReceipt(payload: unknown): HealthRepairReceipt {
  const row = record(payload)
  if (typeof row.id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(row.id) || typeof row.bytes !== 'number' || !Number.isSafeInteger(row.bytes) || row.bytes < 0 || row.bytes > 64 * 1024 * 1024) throw new Error('Invalid recovery receipt.')
  return { id: row.id, vault_id: boundedString(row.vault_id), path: vaultPath(row.path), hash: hash(row.hash), bytes: row.bytes }
}
