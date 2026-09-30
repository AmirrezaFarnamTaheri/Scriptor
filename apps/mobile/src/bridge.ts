import { invoke } from '@tauri-apps/api/core'
import { record, parseNote, parseSearch, parseMetadata, string } from './storage'

let scope = 0
export async function lifecycle(foreground: boolean, cancel = false): Promise<void> {
  const value = record(await invoke<unknown>('mobile_lifecycle', { foreground, cancel }))
  if (typeof value.scope !== 'number' || !Number.isSafeInteger(value.scope)) throw new Error('Invalid runtime session')
  scope = value.scope
}
async function request(operation: string, fields: Record<string, unknown>): Promise<unknown> {
  return invoke<unknown>('mobile_request', { request: { operation, scope, ...fields } })
}
export async function read(path: string) { return parseNote(await request('read', { path })) }
export async function search(query: string) { return parseSearch(await request('search', { query })) }
export async function save(path: string, markdown: string, expectedHash: string) {
  return parseMetadata(record(await request('save', { path, markdown, expected_hash: expectedHash })).metadata)
}
export interface Revision { id: string; saved_at: string; preview: string }
export async function history(path: string): Promise<Revision[]> {
  const value = await request('history', { path })
  if (!Array.isArray(value) || value.length > 50) throw new Error('Invalid revision history')
  return value.map(item => { const entry = record(item); return { id: string(entry.id), saved_at: string(entry.saved_at), preview: string(entry.preview) } })
}
export async function revision(path: string, id: string) { return string(await request('revision', { path, id })) }
export async function restore(path: string, id: string, expectedHash: string) {
  return parseMetadata(record(await request('restore', { path, id, expected_hash: expectedHash })).metadata)
}
