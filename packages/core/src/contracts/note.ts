import type { VaultId, VaultRelativePath } from './vault'

export type NoteId = string

export interface NoteMetadata {
  id: NoteId
  vaultId: VaultId
  path: VaultRelativePath
  title: string
  contentHash: string
  modifiedAt: string
  wordCount: number
  tags: string[]
}

export interface ReadNoteInput {
  vaultId: VaultId
  path: VaultRelativePath
}

export interface ReadNoteOutput {
  metadata: NoteMetadata
  markdown: string
}

export interface SaveNoteInput {
  vaultId: VaultId
  path: VaultRelativePath
  markdown: string
  expectedContentHash?: string
}

export interface SaveNoteOutput {
  metadata: NoteMetadata
  previousContentHash?: string
}

export interface RenameNoteDryRunInput {
  vaultId: VaultId
  fromPath: VaultRelativePath
  toPath: VaultRelativePath
  updateLinks: boolean
}

export interface RenameNoteDryRunOutput {
  affectedFiles: VaultRelativePath[]
  linkEdits: number
  warnings: string[]
}

