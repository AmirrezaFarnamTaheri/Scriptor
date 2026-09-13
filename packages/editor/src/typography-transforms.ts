import type { StateCommand } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'

import type { TypographyAction } from './typography-actions.ts'
import {
  addSpacesAroundEmdashesText,
  doubleQuotesToSingleText,
  italicsToQuotesText,
  quotesToItalicsText,
  removeLineBreaksText,
  removeSpacesAroundEmdashesText,
  replaceDelimited,
  singleQuotesToDoubleText,
  straightenQuotesText,
  stripDuplicateSpacesText,
  toDoubleQuotesText,
  toSentenceCaseText,
  toTitleCaseText,
  zapGremlinsText,
  type TransformText,
} from './typography-logic.ts'

export { replaceDelimited, type TransformText }

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

export const zapGremlins: StateCommand = transformSelectedText(zapGremlinsText)

export const stripDuplicateSpaces: StateCommand = transformSelectedText(stripDuplicateSpacesText)

export const removeLineBreaks: StateCommand = transformSelectedText(removeLineBreaksText)

export const straightenQuotes: StateCommand = transformSelectedText(straightenQuotesText)

export const toDoubleQuotes: StateCommand = transformSelectedText(toDoubleQuotesText)

export const doubleQuotesToSingle: StateCommand = transformSelectedText(doubleQuotesToSingleText)

export const singleQuotesToDouble: StateCommand = transformSelectedText(singleQuotesToDoubleText)

export const addSpacesAroundEmdashes: StateCommand = transformSelectedText(addSpacesAroundEmdashesText)

export const removeSpacesAroundEmdashes: StateCommand = transformSelectedText(removeSpacesAroundEmdashesText)

export function toTitleCase(locale = 'en'): StateCommand {
  return transformSelectedText((text) => toTitleCaseText(text, locale))
}

export function toSentenceCase(locale = 'en'): StateCommand {
  return (target) => {
    const range = target.state.selection.main
    const text = target.state.sliceDoc(range.from, range.to)
    const sentence = toSentenceCaseText(text, locale)
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
  return transformSelectedText((text) => quotesToItalicsText(text, marker))
}

export const italicsToQuotes: StateCommand = transformSelectedText(italicsToQuotesText)

export { TYPOGRAPHY_ACTIONS } from './typography-actions.ts'
export type { TypographyAction } from './typography-actions.ts'

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
