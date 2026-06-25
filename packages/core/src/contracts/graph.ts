import type { NoteId } from './note'
import type { VaultId, VaultRelativePath } from './vault'

export type LinkKind = 'markdown' | 'wikilink' | 'heading' | 'asset' | 'external'

export interface LinkEdge {
  id: string
  vaultId: VaultId
  fromNoteId: NoteId
  toNoteId?: NoteId
  toPath?: VaultRelativePath
  kind: LinkKind
  label: string
  line?: number
}

export interface GraphQueryInput {
  vaultId: VaultId
  focusNoteId?: NoteId
  depth?: number
  includeUnresolved?: boolean
}

export interface GraphQueryOutput {
  nodes: Array<{ id: string; label: string; path?: VaultRelativePath; unresolved?: boolean }>
  edges: Array<{ id: string; source: string; target: string; kind: LinkKind }>
}

export interface BacklinksInput {
  vaultId: VaultId
  noteId: NoteId
}

export interface BacklinksOutput {
  edges: LinkEdge[]
}

