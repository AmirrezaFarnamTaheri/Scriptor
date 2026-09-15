import type { TypographyAction } from './typography-actions.ts'

export type TransformText = (text: string) => string

export function delimit(delimiter: string): (text: string) => string[] {
  const pattern = new RegExp(`(${delimiter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'g')
  return (text: string) => text.split(pattern)
}

export function replaceDelimited(delimiter: string, replacement: string): TransformText {
  return (text: string) => {
    const chunks = delimit(delimiter)(text)
    return chunks
      .map((chunk, index) => (index % 2 === 1 ? replacement : chunk))
      .join('')
  }
}

export const zapGremlinsText: TransformText = (text) =>
  text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u00AD\u200A]/g, '')

export const stripDuplicateSpacesText: TransformText = (text) =>
  text.replace(/ {2,}/g, ' ')

export const removeLineBreaksText: TransformText = (text) =>
  text.replace(/\r?\n/g, ' ').replace(/ {2,}/g, ' ')

export const straightenQuotesText: TransformText = (text) =>
  text.replace(/[\u201C\u201D\u201E\u00AB\u00BB]/g, '"').replace(/[\u2018\u2019\u201A]/g, "'")

export const toDoubleQuotesText: TransformText = (text) =>
  replaceDelimited("'", '"')(replaceDelimited('`', '"')(text))

export const doubleQuotesToSingleText: TransformText = (text) =>
  replaceDelimited('"', "'")(text)

export const singleQuotesToDoubleText: TransformText = (text) =>
  replaceDelimited("'", '"')(text)

export const addSpacesAroundEmdashesText: TransformText = (text) =>
  text.replace(/([^ ])—/g, '$1 —').replace(/—([^ ])/g, '— $1')

export const removeSpacesAroundEmdashesText: TransformText = (text) =>
  text.replace(/ —/g, '—').replace(/— /g, '—')

export function toTitleCaseText(text: string, locale = 'en'): string {
  const segmenter = new Intl.Segmenter(locale, { granularity: 'word' })
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
}

export function toSentenceCaseText(text: string, locale = 'en'): string {
  const lower = text.toLocaleLowerCase(locale)
  const [first, ...rest] = lower
  return (first?.toLocaleUpperCase(locale) ?? '') + rest.join('')
}

export function quotesToItalicsText(text: string, marker: '*' | '_' = '*'): string {
  return replaceDelimited('"', marker)(text)
}

export const italicsToQuotesText: TransformText = (text) =>
  text.replace(/\*([^*]+)\*/g, '"$1"').replace(/_([^_]+)_/g, '"$1"')

export function applyTypographyToText(
  text: string,
  action: TypographyAction,
  locale = 'en',
): string {
  switch (action) {
    case 'zapGremlins':
      return zapGremlinsText(text)
    case 'stripDuplicateSpaces':
      return stripDuplicateSpacesText(text)
    case 'removeLineBreaks':
      return removeLineBreaksText(text)
    case 'straightenQuotes':
      return straightenQuotesText(text)
    case 'toDoubleQuotes':
      return toDoubleQuotesText(text)
    case 'doubleQuotesToSingle':
      return doubleQuotesToSingleText(text)
    case 'singleQuotesToDouble':
      return singleQuotesToDoubleText(text)
    case 'addSpacesAroundEmdashes':
      return addSpacesAroundEmdashesText(text)
    case 'removeSpacesAroundEmdashes':
      return removeSpacesAroundEmdashesText(text)
    case 'toTitleCase':
      return toTitleCaseText(text, locale)
    case 'toSentenceCase':
      return toSentenceCaseText(text, locale)
    case 'quotesToItalics':
      return quotesToItalicsText(text)
    case 'italicsToQuotes':
      return italicsToQuotesText(text)
    default:
      return text
  }
}
