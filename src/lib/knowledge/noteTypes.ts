import type { NoteIndexSummary } from './inbox.ts'

export interface NoteTypeDefinition {
  name: string
  path: string
  template?: string
  icon?: string
  color?: string
}

export function discoverNoteTypes(
  summaries: NoteIndexSummary[],
  typesDirectory = 'type',
): NoteTypeDefinition[] {
  const prefix = `${typesDirectory.replace(/\/$/, '')}/`
  return summaries
    .filter((note) => note.note_type === 'Type' && note.path.startsWith(prefix))
    .map((note) => {
      const name = note.title || note.path.replace(prefix, '').replace(/\.md$/i, '')
      return { name, path: note.path }
    })
    .sort((left, right) => left.name.localeCompare(right.name))
}

export function defaultTypePath(typesDirectory: string, typeName: string): string {
  const slug = typeName.trim().replace(/\s+/g, '-')
  return `${typesDirectory.replace(/\/$/, '')}/${slug}.md`
}

export function defaultInstancePath(typeName: string, title: string): string {
  const slug = title.trim().replace(/\.md$/i, '').replace(/\s+/g, ' ')
  const prefix = typeName.trim().replace(/\s+/g, '-')
  return `${prefix}/${slug}.md`
}
