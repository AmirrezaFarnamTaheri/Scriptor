/**
 * Prose Autosuggest for Scriptor
 * =================================
 * Context-aware word/phrase completion that mines:
 *   1. Current document (inline words already used)
 *   2. Vault index (corpus-wide term frequency)
 *   3. Open tabs (words from other currently-open notes)
 *   4. LRU cache (previously accepted suggestions, persisted in sessionStorage)
 *
 * The source priority order is: accepted-cache > current-doc > open-tabs > vault.
 * Suggestions are only offered when the user types >= MIN_PREFIX chars of a word
 * that is NOT currently inside a [[wikilink]], @citation, #tag, code block, or URL.
 *
 * CodeMirror integration: add `proseAutosuggestExtension(options)` to the editor.
 * Update the suggestion corpus at any time via `dispatchProseCorpus(view, corpus)`.
 */

import { autocompletion, type Completion, type CompletionContext, type CompletionResult } from '@codemirror/autocomplete'
import { StateEffect, StateField, type Extension } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'

import { extractBigrams, extractWords } from './prose-mining.ts'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface ProseAutosuggestOptions {
  /** Minimum characters typed before suggestions appear. Default: 3 */
  minPrefix?: number
  /** Maximum suggestions shown at once. Default: 8 */
  maxSuggestions?: number
  /** Enable suggestions from the current document. Default: true */
  useCurrentDoc?: boolean
  /** Enable suggestions from open tabs. Default: true */
  useOpenTabs?: boolean
  /** Enable suggestions from vault corpus. Default: true */
  useVaultCorpus?: boolean
  /** Enable the accepted-word LRU cache. Default: true */
  useAcceptedCache?: boolean
  /** Max phrases (multi-word) to surface from the current doc. Default: 20 */
  maxDocPhrases?: number
}

const DEFAULTS: Required<ProseAutosuggestOptions> = {
  minPrefix: 3,
  maxSuggestions: 8,
  useCurrentDoc: true,
  useOpenTabs: true,
  useVaultCorpus: true,
  useAcceptedCache: true,
  maxDocPhrases: 20,
}

// ---------------------------------------------------------------------------
// Corpus state (updated externally by the app shell)
// ---------------------------------------------------------------------------

export interface ProseCorpus {
  /** Words extracted from vault-wide index, sorted by frequency desc. */
  vaultTerms: string[]
  /** Words from currently open tabs (other than the active note). */
  openTabTerms: string[]
}

export const updateProseCorpus = StateEffect.define<ProseCorpus>()

const proseCorpusField = StateField.define<ProseCorpus>({
  create: () => ({ vaultTerms: [], openTabTerms: [] }),
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(updateProseCorpus)) return effect.value
    }
    return value
  },
})

// ---------------------------------------------------------------------------
// Accepted-word LRU cache (sessionStorage backed, 200-entry cap)
// ---------------------------------------------------------------------------

const CACHE_KEY = 'scriptor:prose-autosuggest-cache'
const CACHE_MAX = 200

function loadAcceptedCache(): string[] {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveAcceptedCache(terms: string[]): void {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(terms.slice(0, CACHE_MAX)))
  } catch {
    // storage unavailable — silently ignore
  }
}

function recordAccepted(term: string): void {
  const cache = loadAcceptedCache().filter((t) => t !== term)
  cache.unshift(term)
  saveAcceptedCache(cache.slice(0, CACHE_MAX))
}

// ---------------------------------------------------------------------------
// Text mining helpers — live in prose-mining.ts so callers that only need
// corpus building do not pull in the CodeMirror runtime.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Guard: don't complete inside structural markers
// ---------------------------------------------------------------------------

function isInsideStructure(before: string): boolean {
  // Inside a wikilink, citation, tag, URL, or code span
  return (
    /\[\[[^\]]*$/.test(before) ||
    /\[@[^\]]*$/.test(before) ||
    /#[\w/-]*$/.test(before) ||
    /`[^`]*$/.test(before) ||
    /https?:\/\/\S*$/.test(before)
  )
}

// ---------------------------------------------------------------------------
// Main completion source
// ---------------------------------------------------------------------------

function buildSource(
  opts: Required<ProseAutosuggestOptions>,
): (ctx: CompletionContext) => CompletionResult | null {
  return (ctx: CompletionContext): CompletionResult | null => {
    const line = ctx.state.doc.lineAt(ctx.pos)
    const before = line.text.slice(0, ctx.pos - line.from)

    // Match a word-in-progress at the cursor (letters only, no digits prefix)
    const wordMatch = before.match(/\b([A-Za-z][a-z]*)$/)
    if (!wordMatch) return null

    const prefix = wordMatch[1] ?? ''
    if (prefix.length < opts.minPrefix) return null

    // Don't complete inside [[, [@, #, `, http
    if (isInsideStructure(before)) return null

    const lower = prefix.toLowerCase()
    const from = ctx.pos - prefix.length

    // Build candidate pool from all sources
    const corpus = ctx.state.field(proseCorpusField)
    const candidates: Array<{ term: string; priority: number }> = []

    // 1. Accepted cache (highest priority)
    if (opts.useAcceptedCache) {
      for (const term of loadAcceptedCache()) {
        if (term.toLowerCase().startsWith(lower) && term !== prefix) {
          candidates.push({ term, priority: 0 })
        }
      }
    }

    // 2. Current document words + bigrams
    if (opts.useCurrentDoc) {
      const docText = ctx.state.doc.toString()
      for (const word of extractWords(docText)) {
        if (word.startsWith(lower) && word !== lower) {
          candidates.push({ term: word, priority: 1 })
        }
      }
      for (const bigram of extractBigrams(docText, opts.maxDocPhrases)) {
        if (bigram.startsWith(lower)) {
          candidates.push({ term: bigram, priority: 1 })
        }
      }
    }

    // 3. Open tabs
    if (opts.useOpenTabs) {
      for (const term of corpus.openTabTerms) {
        if (term.startsWith(lower) && term !== lower) {
          candidates.push({ term, priority: 2 })
        }
      }
    }

    // 4. Vault corpus
    if (opts.useVaultCorpus) {
      for (const term of corpus.vaultTerms) {
        if (term.startsWith(lower) && term !== lower) {
          candidates.push({ term, priority: 3 })
        }
      }
    }

    if (candidates.length === 0) return null

    // Deduplicate, sort by priority, cap
    const seen = new Set<string>()
    const deduped: Array<{ term: string; priority: number }> = []
    for (const c of candidates.sort((a, b) => a.priority - b.priority)) {
      if (!seen.has(c.term)) {
        seen.add(c.term)
        deduped.push(c)
      }
      if (deduped.length >= opts.maxSuggestions) break
    }

    const sourceLabel = ['cache', 'doc', 'tab', 'vault']
    const options: Completion[] = deduped.map(({ term, priority }, index) => ({
      label: term,
      type: 'text',
      detail: sourceLabel[priority],
      boost: (opts.maxSuggestions - index) * 0.1,
      apply: (view: EditorView, _completion: Completion, applyFrom: number, applyTo: number) => {
        view.dispatch({
          changes: { from: applyFrom, to: applyTo, insert: term },
          selection: { anchor: applyFrom + term.length },
        })
        // Record in cache whenever the user explicitly accepts
        recordAccepted(term)
      },
    }))

    return { from, options, filter: false }
  }
}

// ---------------------------------------------------------------------------
// Public extension
// ---------------------------------------------------------------------------

/**
 * CodeMirror extension providing prose-level autosuggestions.
 *
 * Add to the editor extensions array:
 * ```ts
 * proseAutosuggestExtension({ minPrefix: 3 })
 * ```
 *
 * Then feed the corpus whenever it changes:
 * ```ts
 * dispatchProseCorpus(view, { vaultTerms, openTabTerms })
 * ```
 */
export function proseAutosuggestExtension(options: ProseAutosuggestOptions = {}): ReturnType<typeof autocompletion>[] {
  return [
    ...proseAutosuggestState(),
    autocompletion({
      activateOnTyping: true,
      defaultKeymap: true,
      override: [proseAutosuggestSource(options)],
    }),
  ]
}

export function proseAutosuggestState(): Extension[] {
  return [proseCorpusField]
}

export function proseAutosuggestSource(options: ProseAutosuggestOptions = {}) {
  const opts = { ...DEFAULTS, ...options }
  return buildSource(opts)
}

/**
 * Update the prose corpus (vault terms + open tab terms).
 * Call this whenever vault search results change or tabs are opened/closed.
 */
export function dispatchProseCorpus(view: EditorView, corpus: ProseCorpus): void {
  view.dispatch({ effects: updateProseCorpus.of(corpus) })
}

/**
 * Extract word/term corpus from a collection of note contents.
 * Re-exported from the CodeMirror-free `prose-mining.ts`.
 */
export { buildVaultCorpus } from './prose-mining.ts'

/**
 * Clear the accepted-word LRU cache stored in sessionStorage.
 */
export function clearProseAutosuggestCache(): void {
  try {
    sessionStorage.removeItem(CACHE_KEY)
  } catch {
    // ignore
  }
}
