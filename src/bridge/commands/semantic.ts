import { invoke } from '@tauri-apps/api/core'

import { requireNative } from '../native.ts'
import { authorizeSensitiveOperation } from './authorization.ts'
import { parseSemanticInspection, type SemanticInspection } from '../../lib/semanticInspector.ts'

export async function semanticInspect(limit = 128, expectedVaultId?: string): Promise<SemanticInspection> {
  requireNative()
  if (!Number.isInteger(limit) || limit < 1 || limit > 256) throw new Error('Projection limit must be between 1 and 256')
  return parseSemanticInspection(JSON.parse(await invoke<string>('semantic_inspect', { limit, expectedVaultId: expectedVaultId ?? null })) as unknown)
}

export async function semanticSetApiKey(secret: string): Promise<void> {
  requireNative()
  const authorizationToken = await authorizeSensitiveOperation('keychain_write', 'semantic.openai.key')
  await invoke('semantic_set_api_key', { secret, authorizationToken })
}

export async function semanticDeleteApiKey(): Promise<void> {
  requireNative()
  const authorizationToken = await authorizeSensitiveOperation('keychain_delete', 'semantic.openai.key')
  await invoke('semantic_delete_api_key', { authorizationToken })
}

/** Semantic hit overlaying BM25 keyword results by note path. */
export interface SemanticSearchHit {
  note_path: string
  score: number
}

/** Thrown when semantic search is not configured for the vault. */
export class SemanticUnavailableError extends Error {
  constructor(context: string) {
    super(`${context}: semantic search is not configured for this vault`)
    this.name = 'SemanticUnavailableError'
  }
}

function parseSemanticPayload<T>(payload: string, context: string): T {
  const parsed = JSON.parse(payload) as Record<string, unknown>
  if (parsed.available === false) {
    // The vault has no `semantic` section; callers fall back to keyword search.
    throw new SemanticUnavailableError(context)
  }
  return parsed as T
}

export async function semanticSearch(query: string, limit = 25, expectedVaultId?: string): Promise<SemanticSearchHit[]> {
  requireNative()
  const authorizationToken = await authorizeSensitiveOperation('ai_network_request', query)
  const payload = await invoke<string>('semantic_search', {
    query,
    limit,
    expectedVaultId: expectedVaultId ?? null,
    authorizationToken,
  })
  return parseSemanticPayload<SemanticSearchHit[]>(payload, 'semantic search')
}

export interface SemanticSyncReport {
  total_notes: number
  embedded: number
  unchanged: number
  removed: number
}

export async function semanticSync(expectedVaultId?: string): Promise<SemanticSyncReport> {
  requireNative()
  const authorizationToken = await authorizeSensitiveOperation(
    'ai_network_request',
    'Re-embed changed notes for semantic search',
  )
  const payload = await invoke<string>('semantic_sync', { authorizationToken, expectedVaultId: expectedVaultId ?? null })
  return parseSemanticPayload<SemanticSyncReport>(payload, 'semantic sync')
}
