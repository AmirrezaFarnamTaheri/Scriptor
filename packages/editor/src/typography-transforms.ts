import { type EditorSelection, type StateCommand, type Transaction } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'

export type TransformText = (text: string) => string

function delimit(delimiter: string): (text: string) => string[] {
  const pattern = new RegExp(`(${delimiter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'g')
  return (text: string) => text.split(pattern).filter(Boolean)
}

function replaceDelimited(delimiter: string, replacement: string): TransformText {
  return (text: string) => {
    const chunks = delimit(delimiter)(text)
    return chunks
      .map((chunk, index) => (index % 2 === 1 ? replacement : chunk))
      .join('')
  }
}

export function transformSelectedText(transform: TransformText): StateCommand {
  return (target) => {
    const changes: { from: number; to: number; insert: string }[] = []
    for (const range of target.state.selection.ranges) {
      const slice = target.state.sliceDoc(range.from, range.to)
      const next = transform(slice)
      if (next !== slice) {
        changes.push({ from: range.from, to: range.to, insert: next })
      }
    }
    if (changes.length === 0) return false
    target.dispatch(target.state.update({ changes, scrollIntoView: true }))
    return true
  }
}

export const zapGremlins: StateCommand = transformSelectedText((text) =>
  text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u00AD\u200A]/g, ''),
)

export const stripDuplicateSpaces: StateCommand = transformSelectedText((text) =>
  text.replace(/ {2,}/g, ' '),
)

export const removeLineBreaks: StateCommand = transformSelectedText((text) =>
  text.replace(/\r?\n/g, ' ').replace(/ {2,}/g, ' '),
)

export const straightenQuotes: StateCommand = transformSelectedText((text) =>
  text.replace(/[\u201C\u201D\u201E\u00AB\u00BB]/g, '"').replace(/[\u2018\u2019\u201A]/g, "'"),
)

export const toDoubleQuotes: StateCommand = transformSelectedText((text) =>
  replaceDelimited("'", '"')(replaceDelimited('`', '"')(text)),
)

export const doubleQuotesToSingle: StateCommand = transformSelectedText(replaceDelimited('"', "'"))

export const singleQuotesToDouble: StateCommand = transformSelectedText(replaceDelimited("'", '"'))

export const addSpacesAroundEmdashes: StateCommand = transformSelectedText((text) =>
  text.replace(/([^ ])—/g, '$1 —').replace(/—([^ ])/g, '— $1'),
)

export const removeSpacesAroundEmdashes: StateCommand = transformSelectedText((text) =>
  text.replace(/ —/g, '—').replace(/— /g, '—'),
)

export function toTitleCase(locale = 'en'): StateCommand {
  const segmenter = new Intl.Segmenter(locale, { granularity: 'word' })
  return transformSelectedText((text) => {
    const segments = Array.from(segmenter.segment(text))
    let output = ''
    let cursor = 0
    for (const segment of segments) {
      output += text.slice(cursor, segment.index)
      const word = segment.segment
      if (segment.isWordLike) {
        const [first, ...rest] = [...word]
        output += first?.toLocaleUpperCase(locale) ?? ''
        output += rest.join('').toLocaleLowerCase(locale)
      } else {
        output += word
      }
      cursor = segment.index + word.length
    }
    output += text.slice(cursor)
    return output
  })
}

export function toSentenceCase(locale = 'en'): StateCommand {
  return (target) => {
    const range = target.state.selection.main
    const text = target.state.sliceDoc(range.from, range.to)
    const lower = text.toLocaleLowerCase(locale)
    const [first, ...rest] = lower
    const sentence = (first?.toLocaleUpperCase(locale) ?? '') + rest.join('')
    if (sentence === text) return false
    target.dispatch(
      target.state.update({
        changes: { from: range.from, to: range.to, insert: sentence },
        scrollIntoView: true,
      }),
    )
    return true
  }
}

export function quotesToItalics(marker: '*' | '_' = '*'): StateCommand {
  return transformSelectedText(replaceDelimited('"', `${marker}$1${marker}`.replace('$1', '')))
}

export const italicsToQuotes: StateCommand = transformSelectedText((text) =>
  text.replace(/\*([^*]+)\*/g, '"$1"').replace(/_([^_]+)_/g, '"$1"'),
)

export const TYPOGRAPHY_ACTIONS = [
  'zapGremlins',
  'stripDuplicateSpaces',
  'removeLineBreaks',
  'straightenQuotes',
  'toDoubleQuotes',
  'doubleQuotesToSingle',
  'singleQuotesToDouble',
  'addSpacesAroundEmdashes',
  'removeSpacesAroundEmdashes',
  'toTitleCase',
  'toSentenceCase',
  'quotesToItalics',
  'italicsToQuotes',
] as const

export type TypographyAction = (typeof TYPOGRAPHY_ACTIONS)[number]

export function applyTypographyAction(view: EditorView, action: TypographyAction, locale = 'en'): void {
  const commands: Record<TypographyAction, StateCommand> = {
    zapGremlins,
    stripDuplicateSpaces,
    removeLineBreaks,
    straightenQuotes,
    toDoubleQuotes,
    doubleQuotesToSingle,
    singleQuotesToDouble,
    addSpacesAroundEmdashes,
    removeSpacesAroundEmdashes,
    toTitleCase: toTitleCase(locale),
    toSentenceCase: toSentenceCase(locale),
    quotesToItalics: quotesToItalics('*'),
    italicsToQuotes,
  }
  commands[action]({
    state: view.state,
    dispatch: (transaction) => view.dispatch(transaction),
  })
}

export function composeTypographyChanges(
  ranges: readonly EditorSelection['ranges'][number][],
  doc: string,
  action: TypographyAction,
  locale = 'en',
): Transaction | null {
  const transform = (text: string): string => {
    const view = { state: { sliceDoc: () => text } } as unknown as EditorView
    applyTypographyAction(view, action, locale)
    return text
  }
  const changes = ranges
    .map((range) => {
      const slice = doc.slice(range.from, range.to)
      const next = transform(slice)
      return next !== slice ? { from: range.from, to: range.to, insert: next } : null
    })
    .filter(Boolean) as { from: number; to: number; insert: string }[]
  return changes.length ? { changes } as unknown as Transaction : null
}
