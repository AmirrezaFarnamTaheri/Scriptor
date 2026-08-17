import { useState, useMemo, useEffect, useRef, useCallback, type RefObject } from 'react'
import type { MarkdownEditorHandle, TocEntry } from '@scriptor/editor'
import {
  configureLanguageTool,
  loadHunspellLocale,
  setActiveHunspellLocale,
} from '@scriptor/editor/pure'
import type { MarkdownPreviewHandle } from '@scriptor/renderer'
import { generateTocFromMarkdown } from '../lib/tocFromMarkdown'
import { useEditorLintProblems } from '../hooks/useEditorLintProblems'
import { useEditorPreviewScrollSync } from '../hooks/useEditorPreviewScrollSync'
import {
  indexerExecuteDql,
  indexerResolveWikilink,
  plantumlRender,
  vaultReadNote,
} from '../bridge/commands'
import type { BibliographyEntry, ScannedEntry } from '../types/vault'

export interface EditorOrchestrationOptions {
  activePath: string | null
  draftMarkdown: string
  activeTitle?: string
  activeTags?: string[]
  vaultTags: string[]
  entries: ScannedEntry[]
  bibliography: BibliographyEntry[]
  spellcheck: boolean
  spellcheckLocale: string
  hibernateSpellcheck: boolean
  languageToolEndpoint: string
  nativeReady: boolean
  showSplitPreview: boolean
  showInspectorPreview: boolean
  baseProblemCount: number
}

export function useEditorOrchestrationController({
  activePath,
  draftMarkdown,
  activeTitle,
  activeTags = [],
  vaultTags,
  entries,
  bibliography,
  spellcheck,
  spellcheckLocale,
  hibernateSpellcheck,
  languageToolEndpoint,
  nativeReady,
  showSplitPreview,
  showInspectorPreview,
  baseProblemCount,
}: EditorOrchestrationOptions) {
  const [visibleEditorLine, setVisibleEditorLine] = useState(1)
  const editorRef = useRef<MarkdownEditorHandle | null>(null)
  const previewRef = useRef<MarkdownPreviewHandle | null>(null)
  const inspectorPanelRef = useRef<HTMLElement | null>(null)
  const splitPreviewScrollRef = useRef<HTMLElement | null>(null)

  // ── Spellcheck & LanguageTool configuration ────────────────────────────────
  useEffect(() => {
    if (spellcheck && !hibernateSpellcheck) {
      setActiveHunspellLocale(spellcheckLocale)
      void loadHunspellLocale(spellcheckLocale)
    }
  }, [spellcheck, spellcheckLocale, hibernateSpellcheck])

  useEffect(() => {
    configureLanguageTool({ endpoint: languageToolEndpoint })
  }, [languageToolEndpoint])

  // ── TOC extraction ────────────────────────────────────────────────────────
  const tocEntries = useMemo<TocEntry[]>(() => {
    if (!activePath) return []
    return generateTocFromMarkdown(draftMarkdown)
  }, [activePath, draftMarkdown])

  // ── Autocomplete Contexts ──────────────────────────────────────────────────
  const editorAutocompleteContext = useMemo(
    () => ({
      notePaths: entries.filter((entry) => entry.kind === 'note').map((entry) => entry.path),
      tags: [...new Set([...activeTags, ...vaultTags])],
      headings: tocEntries.map((entry) => entry.text.replace(/\{#([^}]+)\}/, '').trim()),
      bibliographyKeys: bibliography.map((entry) => entry.key),
    }),
    [activeTags, bibliography, entries, tocEntries, vaultTags],
  )

  const monacoCompletionContext = useMemo(
    () => ({
      notePaths: editorAutocompleteContext.notePaths,
      tags: editorAutocompleteContext.tags,
      headings: editorAutocompleteContext.headings,
    }),
    [editorAutocompleteContext],
  )

  // ── Snippet Context ────────────────────────────────────────────────────────
  const snippetContext = useMemo(() => {
    if (!activePath) return undefined
    const segments = activePath.split('/')
    const filename = segments[segments.length - 1] ?? activePath
    const directory = segments.slice(0, -1).join('/')
    const extension = filename.includes('.') ? filename.slice(filename.lastIndexOf('.')) : ''
    return {
      filename,
      directory,
      extension,
      title: activeTitle ?? filename.replace(/\.md$/i, ''),
    }
  }, [activePath, activeTitle])

  // ── Scroll Sync ────────────────────────────────────────────────────────────
  const scrollSyncEnabled = showSplitPreview || showInspectorPreview
  const scrollContainerRef = (showSplitPreview
    ? splitPreviewScrollRef
    : inspectorPanelRef) as RefObject<HTMLElement | null>

  const { handleEditorLine: syncEditorLine } = useEditorPreviewScrollSync({
    enabled: scrollSyncEnabled,
    editorRef,
    previewRef,
    scrollContainerRef,
  })

  const handleEditorLine = useCallback(
    (line: number) => {
      setVisibleEditorLine(line)
      syncEditorLine(line)
    },
    [syncEditorLine],
  )

  // ── Lint & Problem Aggregation ─────────────────────────────────────────────
  const editorLintMessages = useEditorLintProblems(draftMarkdown, Boolean(activePath))
  const totalProblemCount = baseProblemCount + editorLintMessages.length

  // ── Bridge Preview Callbacks ───────────────────────────────────────────────
  const executeDql = useCallback((query: string) => indexerExecuteDql(query), [])

  const previewFetchNote = useCallback(
    async (target: string): Promise<string | null> => {
      if (!nativeReady) return null
      const trimmed = target.trim()
      if (!trimmed) return null
      try {
        const doc = await vaultReadNote(trimmed)
        return doc.markdown
      } catch {
        try {
          const resolved = await indexerResolveWikilink(trimmed)
          if (resolved.path) {
            const doc = await vaultReadNote(resolved.path)
            return doc.markdown
          }
        } catch {
          return null
        }
      }
      return null
    },
    [nativeReady],
  )

  const previewPlantUmlLocal = useCallback(
    async (source: string) => {
      if (!nativeReady) return null
      try {
        const { svg } = await plantumlRender(source)
        return svg
      } catch {
        return null
      }
    },
    [nativeReady],
  )

  return {
    editorRef,
    previewRef,
    inspectorPanelRef,
    splitPreviewScrollRef,
    scrollSyncEnabled,
    visibleEditorLine,
    handleEditorLine,
    tocEntries,
    editorAutocompleteContext,
    monacoCompletionContext,
    snippetContext,
    editorLintMessages,
    totalProblemCount,
    executeDql,
    previewFetchNote,
    previewPlantUmlLocal,
  }
}
