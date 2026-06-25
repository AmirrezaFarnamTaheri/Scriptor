import { linter, type Diagnostic } from '@codemirror/lint'
import type { Extension } from '@codemirror/state'

import { getHunspellDictionary } from './hunspell-dictionary.ts'

const DEFAULT_WORDS = new Set(
  'markdown wikilink frontmatter scriptor pandoc citeproc backlinks graph vault'.split(' '),
)

let customDictionary = new Set<string>()

export function setSpellcheckDictionary(words: Iterable<string>): void {
  customDictionary = new Set(words)
}

function isWordToken(word: string): boolean {
  return /^[A-Za-z][A-Za-z'-]*$/.test(word) && word.length > 2
}

function isKnownWord(word: string): boolean {
  const lower = word.toLowerCase()
  if (DEFAULT_WORDS.has(lower) || customDictionary.has(lower)) return true

  const hunspell = getHunspellDictionary()
  if (hunspell && hunspell.size > 0) {
    return hunspell.has(lower)
  }

  if (typeof window !== 'undefined' && 'spellcheck' in document.createElement('div')) {
    const probe = document.createElement('div')
    probe.contentEditable = 'true'
    probe.spellcheck = true
    probe.textContent = word
    document.body.appendChild(probe)
    const selection = window.getSelection()
    const range = document.createRange()
    range.selectNodeContents(probe)
    selection?.removeAllRanges()
    selection?.addRange(range)
    const misspelled = probe.querySelector('[spellcheck]') !== null
    probe.remove()
    if (!misspelled) return true
  }
  return false
}

export function spellcheckExtension(): Extension {
  return linter((view) => {
    const diagnostics: Diagnostic[] = []
    const text = view.state.doc.toString()
    const wordPattern = /\b[A-Za-z][A-Za-z'-]{2,}\b/g
    let match: RegExpExecArray | null
    while ((match = wordPattern.exec(text)) !== null) {
      const word = match[0]
      if (!isWordToken(word) || isKnownWord(word)) continue
      const from = match.index
      const to = from + word.length
      const source = getHunspellDictionary()?.size ? 'hunspell' : 'spellcheck'
      diagnostics.push({
        from,
        to,
        severity: 'info',
        message: `Possible spelling: ${word}`,
        source,
      })
    }
    return diagnostics
  })
}

export { loadHunspellDictionary } from './hunspell-dictionary.ts'
