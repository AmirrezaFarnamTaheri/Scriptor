/**
 * TextMate-style snippet parser (absorbed from Foam / VS Code snippetParser patterns).
 * Resolves variables, expands tab stops, and returns ordered selection ranges.
 */

export interface SnippetVariableContext {
  filename?: string
  directory?: string
  extension?: string
  title?: string
  clipboard?: string
  now?: Date
}

export interface SnippetTabStop {
  index: number
  from: number
  to: number
}

export interface ExpandedSnippet {
  text: string
  tabStops: SnippetTabStop[]
}

const BUILTIN_VARIABLES = [
  'CURRENT_YEAR',
  'CURRENT_YEAR_SHORT',
  'CURRENT_MONTH',
  'CURRENT_MONTH_NAME',
  'CURRENT_MONTH_NAME_SHORT',
  'CURRENT_DATE',
  'CURRENT_HOUR',
  'CURRENT_MINUTE',
  'CURRENT_SECOND',
  'CURRENT_SECONDS_UNIX',
  'UUID',
  'CLIPBOARD',
  'FILENAME',
  'DIRECTORY',
  'EXTENSION',
  'TITLE',
  'TM_FILENAME',
  'TM_DIRECTORY',
  'TM_FILEPATH',
] as const

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value)
}

function randomUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `00000000-0000-4000-8000-${Math.random().toString(16).slice(2, 14).padEnd(12, '0')}`
}

export function resolveSnippetVariables(template: string, context: SnippetVariableContext = {}): string {
  const now = context.now ?? new Date()
  const month = now.getMonth() + 1
  const day = now.getDate()
  const hour = now.getHours()
  const minute = now.getMinutes()
  const second = now.getSeconds()
  const filename = context.filename ?? ''
  const directory = context.directory ?? ''
  const extension = context.extension ?? ''
  const title = context.title ?? ''

  const values: Record<string, string | undefined> = {
    CURRENT_YEAR: String(now.getFullYear()),
    CURRENT_YEAR_SHORT: String(now.getFullYear()).slice(2),
    CURRENT_MONTH: pad2(month),
    CURRENT_MONTH_NAME: now.toLocaleString(undefined, { month: 'long' }),
    CURRENT_MONTH_NAME_SHORT: now.toLocaleString(undefined, { month: 'short' }),
    CURRENT_DATE: pad2(day),
    CURRENT_HOUR: pad2(hour),
    CURRENT_MINUTE: pad2(minute),
    CURRENT_SECOND: pad2(second),
    CURRENT_SECONDS_UNIX: String(Math.floor(now.getTime() / 1000)),
    UUID: randomUuid(),
    CLIPBOARD: context.clipboard,
    FILENAME: filename,
    DIRECTORY: directory,
    EXTENSION: extension,
    TITLE: title,
    TM_FILENAME: filename,
    TM_DIRECTORY: directory,
    TM_FILEPATH: directory && filename ? `${directory}/${filename}` : filename || directory,
  }

  let output = ''
  let index = 0
  while (index < template.length) {
    const char = template[index]
    if (char === '\\' && index + 1 < template.length) {
      const next = template[index + 1]
      if (next === '$' || next === '{' || next === '}' || next === '\\') {
        output += next
        index += 2
        continue
      }
    }

    if (char === '$' && index + 1 < template.length) {
      const next = template[index + 1]
      if (/[A-Z_]/.test(next)) {
        let end = index + 1
        while (end < template.length && /[A-Z0-9_]/.test(template[end] ?? '')) {
          end += 1
        }
        const name = template.slice(index + 1, end)
        if (BUILTIN_VARIABLES.includes(name as (typeof BUILTIN_VARIABLES)[number])) {
          output += values[name] ?? ''
          index = end
          continue
        }
      }

      if (next === '{') {
        const close = findMatchingBrace(template, index + 1)
        if (close !== -1) {
          const inner = template.slice(index + 2, close)
          const colon = inner.indexOf(':')
          if (colon !== -1) {
            const name = inner.slice(0, colon)
            const defaultValue = inner.slice(colon + 1)
            if (/^[A-Z_][A-Z0-9_]*$/.test(name)) {
              output += values[name] ?? defaultValue
              index = close + 1
              continue
            }
          } else if (/^[A-Z_][A-Z0-9_]*$/.test(inner)) {
            output += values[inner] ?? ''
            index = close + 1
            continue
          }
        }
      }
    }

    output += char
    index += 1
  }

  return output
}

function findMatchingBrace(template: string, openIndex: number): number {
  let depth = 1
  for (let index = openIndex + 1; index < template.length; index += 1) {
    const char = template[index]
    if (char === '\\') {
      index += 1
      continue
    }
    if (char === '{') {
      depth += 1
    } else if (char === '}') {
      depth -= 1
      if (depth === 0) {
        return index
      }
    }
  }
  return -1
}

function parseChoiceOptions(raw: string): string[] {
  const options: string[] = []
  let current = ''
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index]
    if (char === '\\' && index + 1 < raw.length) {
      const next = raw[index + 1]
      if (next === ',' || next === '|' || next === '\\') {
        current += next
        index += 1
        continue
      }
    }
    if (char === ',') {
      options.push(current)
      current = ''
      continue
    }
    current += char
  }
  options.push(current)
  return options
}

export function expandSnippetTemplate(
  template: string,
  rangeOffset = 0,
  context: SnippetVariableContext = {},
): ExpandedSnippet {
  const resolved = resolveSnippetVariables(template, context)
  let text = ''
  const rawStops: SnippetTabStop[] = []
  let index = 0

  while (index < resolved.length) {
    const char = resolved[index]
    if (char === '\\' && index + 1 < resolved.length) {
      const next = resolved[index + 1]
      if (next === '$' || next === '{' || next === '}' || next === '\\') {
        text += next
        index += 2
        continue
      }
    }

    if (char === '$' && index + 1 < resolved.length) {
      const next = resolved[index + 1]
      if (next >= '0' && next <= '9') {
        let end = index + 1
        while (end < resolved.length && resolved[end] >= '0' && resolved[end] <= '9') {
          end += 1
        }
        const stopIndex = Number(resolved.slice(index + 1, end))
        const from = rangeOffset + text.length
        rawStops.push({ index: stopIndex, from, to: from })
        index = end
        continue
      }

      if (next === '{') {
        const close = findMatchingBrace(resolved, index + 1)
        if (close !== -1) {
          const inner = resolved.slice(index + 2, close)
          const pipe = inner.indexOf('|')
          const colon = inner.indexOf(':')

          if (pipe !== -1 && /^\d+$/.test(inner.slice(0, pipe))) {
            const stopIndex = Number(inner.slice(0, pipe))
            const choicesEnd = inner.lastIndexOf('|')
            const choiceText = parseChoiceOptions(inner.slice(pipe + 1, choicesEnd))[0] ?? ''
            const from = rangeOffset + text.length
            const to = from + choiceText.length
            text += choiceText
            rawStops.push({ index: stopIndex, from, to })
            index = close + 1
            continue
          }

          if (colon !== -1 && /^\d+$/.test(inner.slice(0, colon))) {
            const stopIndex = Number(inner.slice(0, colon))
            const defaultText = inner.slice(colon + 1)
            const from = rangeOffset + text.length
            const to = from + defaultText.length
            text += defaultText
            rawStops.push({ index: stopIndex, from, to })
            index = close + 1
            continue
          }

          if (/^\d+$/.test(inner)) {
            const stopIndex = Number(inner)
            const from = rangeOffset + text.length
            rawStops.push({ index: stopIndex, from, to: from })
            index = close + 1
            continue
          }
        }
      }
    }

    text += char
    index += 1
  }

  return {
    text,
    tabStops: normalizeTabStops(text, rangeOffset, rawStops),
  }
}

function normalizeTabStops(text: string, rangeOffset: number, rawStops: SnippetTabStop[]): SnippetTabStop[] {
  if (rawStops.length === 0) {
    return []
  }

  const byIndex = new Map<number, SnippetTabStop[]>()
  for (const stop of rawStops) {
    const bucket = byIndex.get(stop.index) ?? []
    bucket.push(stop)
    byIndex.set(stop.index, bucket)
  }

  const merged: SnippetTabStop[] = []
  for (const [index, stops] of byIndex.entries()) {
    const primary = stops[0]
    merged.push({
      index,
      from: primary.from,
      to: Math.max(primary.to, ...stops.map((stop) => stop.to)),
    })
  }

  merged.sort((left, right) => {
    if (left.index === 0) return 1
    if (right.index === 0) return -1
    return left.index - right.index
  })

  if (!merged.some((stop) => stop.index === 0)) {
    merged.push({
      index: 0,
      from: rangeOffset + text.length,
      to: rangeOffset + text.length,
    })
  }

  return merged
}

export function looksLikeSnippetTemplate(text: string): boolean {
  return /(?<!\\)\$(?:\d|[A-Z_]|{)/.test(text)
}
