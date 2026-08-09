/**
 * useFootnoteManager
 * -------------------
 * Parses footnote references and definitions from Markdown content and provides
 * operations to navigate, renumber, and detect orphaned/missing footnotes.
 *
 * Features:
 *  - Lists all `[^id]` references and `[^id]:` definitions
 *  - Detects orphaned definitions (defined but never referenced)
 *  - Detects missing definitions (referenced but never defined)
 *  - Returns renumbering plan (sequential order by first appearance)
 *  - `applyRenumber` returns the updated Markdown string (caller applies it)
 */

import { useMemo } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FootnoteRef {
  /** The footnote ID as written in the source. */
  id: string
  /** 1-indexed line where this reference appears. */
  line: number
  /** Column offset (0-indexed) of the `[^` opening. */
  col: number
}

export interface FootnoteDef {
  /** The footnote ID. */
  id: string
  /** 1-indexed line of the `[^id]:` definition. */
  line: number
  /** First 120 characters of definition content (for preview). */
  preview: string
}

export interface FootnoteEntry {
  id: string
  refs: FootnoteRef[]
  def: FootnoteDef | null
  /** New sequential ID that would be assigned after renumbering. */
  renumberedId: string | null
}

export interface FootnoteManagerResult {
  /** All footnotes, grouped by ID with refs + definition. */
  entries: FootnoteEntry[]
  /** IDs referenced in text but with no definition. */
  missingDefs: string[]
  /** IDs defined but never referenced in text. */
  orphanDefs: string[]
  /** Renumbered Markdown. Call to preview the rewritten content. */
  applyRenumber: () => string
  /**
   * Return inline + definition snippets for inserting a new footnote.
   * Auto-increments the highest existing numeric label.
   */
  insertFootnote: (content?: string) => { inline: string; definition: string; nextLabel: string }
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

function parseRefs(content: string): FootnoteRef[] {
  const refs: FootnoteRef[] = []
  const lines = content.split('\n')
  // Match inline refs: [^id] but NOT [^id]: (definitions)
  const refRe = /\[\^([^\]]+)\](?!:)/g
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    let m: RegExpExecArray | null
    while ((m = refRe.exec(line)) !== null) {
      refs.push({ id: m[1] ?? '', line: i + 1, col: m.index })
    }
    refRe.lastIndex = 0
  }
  return refs
}

function parseDefs(content: string): FootnoteDef[] {
  const defs: FootnoteDef[] = []
  const lines = content.split('\n')
  const defRe = /^\[\^([^\]]+)\]:\s*(.*)$/
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? ''
    const m = defRe.exec(line)
    if (m) {
      defs.push({
        id: m[1] ?? '',
        line: i + 1,
        preview: (m[2] ?? '').slice(0, 120),
      })
    }
  }
  return defs
}

// ---------------------------------------------------------------------------
// Renumbering
// ---------------------------------------------------------------------------

function buildRenumberMap(entries: FootnoteEntry[]): Map<string, string> {
  // Order entries by their earliest reference line
  const ordered = entries
    .filter((e) => e.refs.length > 0)
    .sort((a, b) => {
      const aLine = Math.min(...a.refs.map((r) => r.line))
      const bLine = Math.min(...b.refs.map((r) => r.line))
      return aLine - bLine
    })

  const map = new Map<string, string>()
  ordered.forEach((e, i) => map.set(e.id, String(i + 1)))
  return map
}

function applyRenumberToContent(content: string, map: Map<string, string>): string {
  if (map.size === 0) return content
  let result = content
  // Sort by longest ID first to avoid substring collisions
  const sorted = Array.from(map.entries()).sort((a, b) => b[0].length - a[0].length)
  for (const [oldId, newId] of sorted) {
    // Replace refs: [^oldId] (not followed by :)
    result = result.replace(
      new RegExp(`\\[\\^${escapeRegex(oldId)}\\](?!:)`, 'g'),
      `[^${newId}]`,
    )
    // Replace definition: [^oldId]:
    result = result.replace(
      new RegExp(`^\\[\\^${escapeRegex(oldId)}\\]:`, 'gm'),
      `[^${newId}]:`,
    )
  }
  return result
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Parse and manage footnotes in the active Markdown document.
 *
 * @param content  Raw Markdown content of the active note.
 */
export function useFootnoteManager(content: string): FootnoteManagerResult {
  return useMemo(() => {
    const refs = parseRefs(content)
    const defs = parseDefs(content)

    const refIds = new Set(refs.map((r) => r.id))
    const defIds = new Set(defs.map((d) => d.id))
    const allIds = new Set([...refIds, ...defIds])

    const defMap = new Map(defs.map((d) => [d.id, d]))
    const refMap = new Map<string, FootnoteRef[]>()
    for (const ref of refs) {
      const list = refMap.get(ref.id) ?? []
      list.push(ref)
      refMap.set(ref.id, list)
    }

    const entries: FootnoteEntry[] = Array.from(allIds).map((id) => ({
      id,
      refs: refMap.get(id) ?? [],
      def: defMap.get(id) ?? null,
      renumberedId: null, // filled below
    }))

    const renumberMap = buildRenumberMap(entries)
    for (const entry of entries) {
      entry.renumberedId = renumberMap.get(entry.id) ?? null
    }

    const missingDefs = Array.from(refIds).filter((id) => !defIds.has(id))
    const orphanDefs = Array.from(defIds).filter((id) => !refIds.has(id))

    const applyRenumber = () => applyRenumberToContent(content, renumberMap)

    const insertFootnote = (text = '') => {
      const maxNumeric = Array.from(allIds)
        .map(Number)
        .filter((n) => Number.isFinite(n))
        .reduce((m, n) => Math.max(m, n), 0)
      const nextLabel = String(maxNumeric + 1)
      return {
        inline: `[^${nextLabel}]`,
        definition: `[^${nextLabel}]: ${text}`,
        nextLabel,
      }
    }

    return { entries, missingDefs, orphanDefs, applyRenumber, insertFootnote }
  }, [content])
}
