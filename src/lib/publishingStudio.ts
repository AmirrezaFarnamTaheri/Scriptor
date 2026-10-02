import type { PublishPlan, ViewNoteHit } from '../types/vault.ts'

export interface DeploymentTarget { accountId: string; project: string; domain: string }
export function validateDeploymentTarget(value: DeploymentTarget): DeploymentTarget {
  const { accountId, project } = value
  const domain = value.domain.trim().toLowerCase()
  if (!/^[a-fA-F0-9]{32}$/.test(accountId)) throw new Error('Enter the Cloudflare account ID (32 hexadecimal characters).')
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(project)) throw new Error('Enter a valid Cloudflare Pages project name.')
  if (domain && (domain.length > 253 || domain.split('.').length < 2 || /^\d+(?:\.\d+){3}$/.test(domain) || domain.split('.').some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)))) throw new Error('Enter a domain name without a scheme, path, or wildcard.')
  return { accountId, project, domain }
}
export function publicationRows(notes: ViewNoteHit[], plan: PublishPlan) {
  const publicNotes = new Map([...plan.new_items, ...plan.changed, ...plan.unchanged].map(note => [note.rel_path, note.content_hash]))
  return notes.map(note => ({ ...note, eligible: publicNotes.has(note.path), contentHash: publicNotes.get(note.path) ?? null }))
}
export function redactPublishingLog(text: string, credential: string) {
  return (credential ? text.split(credential).join('[redacted]') : text).slice(0, 262144)
}
