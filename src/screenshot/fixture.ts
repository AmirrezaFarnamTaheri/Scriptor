import type {
  GraphQueryOutput,
  NoteDocument,
  RebuildSummary,
  ScannedEntry,
  VaultDescriptor,
  VaultHealthDiagnostics,
  VaultHealthReport,
} from '../types/vault'

export const SCREENSHOT_VAULT_ROOT = 'C:/Scriptor/fixtures/minimal'

const HEALTH_SUMMARY: VaultHealthReport = {
  vault_id: 'screenshot-vault',
  broken_links: 0,
  orphan_assets: 0,
  duplicate_titles: 0,
  invalid_frontmatter: 0,
  unresolved_citations: 0,
  indexed_notes: 3,
  total_words: 420,
  slow_exports: 0,
  cache_status: 'fresh',
}

export const SCREENSHOT_VAULT: VaultDescriptor = {
  id: 'screenshot-vault',
  name: 'Research Vault',
  root_path: SCREENSHOT_VAULT_ROOT,
  opened_at: '2026-06-23T12:00:00.000Z',
  status: 'ready',
}

const NOTE_MARKDOWN: Record<string, string> = {
  'Research Plan.md': `# Research Plan

Uses a bibliography citation [@smith2024].

- [[Field Notes]]
- [[Methodology]]

## Outline

1. Collect sources
2. Draft methodology
3. Synthesize findings
`,
  'Field Notes.md': `# Field Notes

Observations from the first literature pass.

- Link back to [[Research Plan]]
`,
  'Methodology.md': `# Methodology

Qualitative synthesis with structured coding.

See [[Research Plan]] for scope.
`,
}

export const SCREENSHOT_SCAN: ScannedEntry[] = [
  { path: 'Research Plan.md', kind: 'note', size_bytes: 240, modified_at: '2026-06-20T10:00:00Z' },
  { path: 'Field Notes.md', kind: 'note', size_bytes: 180, modified_at: '2026-06-21T10:00:00Z' },
  { path: 'Methodology.md', kind: 'note', size_bytes: 160, modified_at: '2026-06-22T10:00:00Z' },
  { path: 'references.bib', kind: 'asset', size_bytes: 120, modified_at: '2026-06-19T10:00:00Z' },
]

export function screenshotNoteDocument(path: string): NoteDocument {
  const title = path.replace(/\.md$/i, '').split('/').pop() ?? path
  const markdown = NOTE_MARKDOWN[path] ?? `# ${title}\n\nScreenshot fixture note.\n`
  return {
    metadata: {
      id: `note-${title.toLowerCase().replace(/\s+/g, '-')}`,
      vault_id: SCREENSHOT_VAULT.id,
      path,
      title,
      content_hash: `hash-${title}`,
      modified_at: '2026-06-23T12:00:00.000Z',
      word_count: markdown.split(/\s+/).length,
      reading_time_minutes: 2,
      tags: path === 'Research Plan.md' ? ['research'] : [],
      note_type: null,
      organized: true,
      archived: false,
    },
    markdown,
  }
}

export function screenshotRebuildSummary(): RebuildSummary {
  return {
    indexed_notes: 3,
    skipped_notes: 0,
    links_written: 4,
    cache_status: 'fresh',
    health: HEALTH_SUMMARY,
  }
}

export function screenshotHealthDiagnostics(): VaultHealthDiagnostics {
  return {
    summary: HEALTH_SUMMARY,
    issues: [],
  }
}

export function screenshotGraph(focusPath?: string | null): GraphQueryOutput {
  const nodes = [
    { id: 'n1', path: 'Research Plan.md', label: 'Research Plan', unresolved: false },
    { id: 'n2', path: 'Field Notes.md', label: 'Field Notes', unresolved: false },
    { id: 'n3', path: 'Methodology.md', label: 'Methodology', unresolved: false },
  ]
  const edges = [
    { id: 'e1', source: 'n1', target: 'n2', kind: 'wikilink' },
    { id: 'e2', source: 'n1', target: 'n3', kind: 'wikilink' },
    { id: 'e3', source: 'n2', target: 'n1', kind: 'wikilink' },
    { id: 'e4', source: 'n3', target: 'n1', kind: 'wikilink' },
  ]
  if (!focusPath) {
    return { nodes, edges }
  }
  const focus = nodes.find((node) => node.path === focusPath)
  if (!focus) {
    return { nodes: [nodes[0]], edges: [] }
  }
  const linked = new Set<string>([focus.id])
  for (const edge of edges) {
    if (edge.source === focus.id) linked.add(edge.target)
    if (edge.target === focus.id) linked.add(edge.source)
  }
  return {
    nodes: nodes.filter((node) => linked.has(node.id)),
    edges: edges.filter((edge) => linked.has(edge.source) && linked.has(edge.target)),
  }
}
