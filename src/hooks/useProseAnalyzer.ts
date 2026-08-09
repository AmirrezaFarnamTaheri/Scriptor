/**
 * Prose analysis engine for Scriptor.
 * Produces diagnostics compatible with useEditorLintProblems.
 *
 * Rules: passive_voice, weasel_words, adverbs, cliches, long_sentence
 */

import { useMemo } from 'react'

export interface ProseDiagnostic {
  ruleId: string
  message: string
  from: number
  to: number
  severity: 'info' | 'warning' | 'error'
}

const WEASEL_WORDS = [
  'very', 'quite', 'rather', 'somewhat', 'fairly', 'pretty', 'mostly', 'largely',
  'basically', 'essentially', 'generally', 'usually', 'extremely', 'incredibly',
]

const CLICHES = [
  'at the end of the day', 'think outside the box', 'low-hanging fruit',
  'move the needle', 'paradigm shift', 'synergy', 'leverage', 'circle back',
  'deep dive', 'bandwidth', 'boil the ocean', 'reinvent the wheel',
  'tip of the iceberg', 'hit the ground running',
]

const PASSIVE_VOICE_RE = /\b(am|is|are|was|were|be|being|been)\s+(\w+ed|built|bought|caught|dealt|done|drawn|driven|eaten|fallen|felt|fought|flown|gone|grown|had|heard|held|kept|known|laid|led|left|lent|lost|made|meant|met|paid|put|read|run|said|seen|sent|set|shown|shut|sung|sat|slept|sold|spent|stood|stuck|taken|taught|told|thought|understood|won|worn|written)\b/gi

const ADVERB_RE = /\b\w+ly\b/g

export interface ProseAnalysisConfig {
  passive_voice: boolean
  weasel_words: boolean
  adverbs: boolean
  cliches: boolean
  long_sentence: boolean
  maxSentenceWords: number
}

export const DEFAULT_PROSE_CONFIG: ProseAnalysisConfig = {
  passive_voice: true,
  weasel_words: true,
  adverbs: false,
  cliches: true,
  long_sentence: true,
  maxSentenceWords: 40,
}

function findAllMatches(
  re: RegExp,
  text: string,
  ruleId: string,
  message: (match: string) => string,
  severity: ProseDiagnostic['severity'] = 'warning',
): ProseDiagnostic[] {
  const results: ProseDiagnostic[] = []
  re.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    results.push({ ruleId, message: message(m[0]), from: m.index, to: m.index + m[0].length, severity })
  }
  return results
}

function stripCodeAndFrontmatter(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, (m) => ' '.repeat(m.length))
    .replace(/`[^`]+`/g, (m) => ' '.repeat(m.length))
    .replace(/^---[\s\S]*?---\n?/m, (m) => ' '.repeat(m.length))
}

export function analyzeProseContent(text: string, config: ProseAnalysisConfig): ProseDiagnostic[] {
  const stripped = stripCodeAndFrontmatter(text)
  const diagnostics: ProseDiagnostic[] = []

  if (config.passive_voice) {
    diagnostics.push(...findAllMatches(PASSIVE_VOICE_RE, stripped, 'passive_voice', (m) => `Passive voice: consider revising "${m}"`, 'info'))
  }

  if (config.weasel_words) {
    for (const word of WEASEL_WORDS) {
      const re = new RegExp(`\\b${word}\\b`, 'gi')
      diagnostics.push(...findAllMatches(re, stripped, 'weasel_words', (m) => `Weasel word: "${m}" weakens your writing`, 'info'))
    }
  }

  if (config.adverbs) {
    diagnostics.push(...findAllMatches(ADVERB_RE, stripped, 'adverbs', (m) => `Adverb: consider a stronger verb instead of "${m}"`, 'info'))
  }

  if (config.cliches) {
    for (const phrase of CLICHES) {
      const escaped = phrase.replace(/[-/]/g, '[-/]')
      const re = new RegExp(`\\b${escaped}\\b`, 'gi')
      diagnostics.push(...findAllMatches(re, stripped, 'cliches', (m) => `Cliche: "${m}"`, 'warning'))
    }
  }

  if (config.long_sentence) {
    const sentenceRe = /[^.!?\n]+[.!?\n]/g
    let sm: RegExpExecArray | null
    sentenceRe.lastIndex = 0
    while ((sm = sentenceRe.exec(stripped)) !== null) {
      const wordCount = sm[0].trim().split(/\s+/).filter(Boolean).length
      if (wordCount > config.maxSentenceWords) {
        diagnostics.push({
          ruleId: 'long_sentence',
          message: `Long sentence (${wordCount} words). Consider breaking it up.`,
          from: sm.index,
          to: sm.index + sm[0].length,
          severity: 'info',
        })
      }
    }
  }

  return diagnostics
}

export function useProseAnalyzer(
  content: string,
  config: ProseAnalysisConfig = DEFAULT_PROSE_CONFIG,
  enabled = false,
): ProseDiagnostic[] {
  return useMemo(() => {
    if (!enabled || !content) return []
    return analyzeProseContent(content, config)
  }, [content, config, enabled])
}