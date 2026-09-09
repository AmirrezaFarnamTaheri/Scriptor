export type ConflictHunkChoice = 'ours' | 'theirs' | 'base'

export interface ConflictHunk {
  id: number
  ours: string
  theirs: string
  /** Exact ancestor text when the source uses diff3 markers. */
  base?: string
  branchLabel: string
  /** Line number in the source file where the `<<<<<<<` marker starts (0-indexed). */
  startLine: number
  /** Line number in the source file after the `>>>>>>>` marker (0-indexed, exclusive). */
  endLine: number
}

export interface ParsedConflictFile {
  hunks: ConflictHunk[]
}

const CONFLICT_START = /^<<<<<<<(?:\s|$)/
const CONFLICT_BASE = /^\|\|\|\|\|\|\|(?:\s|$)/
const CONFLICT_MID = /^=======(?:\s|$)/
const CONFLICT_END = /^>>>>>>>(?:\s|$)/

interface ParsedHunkAt {
  hunk: Omit<ConflictHunk, 'id'>
  nextLine: number
}

/**
 * Parse one complete Git conflict block. Marker-looking prose is only treated
 * as a conflict when a complete ordered block is present; malformed examples
 * remain ordinary text. Diff3 ancestor sections are captured exactly instead
 * of reconstructed from line offsets.
 */
function parseHunkAt(lines: string[], startLine: number): ParsedHunkAt | null {
  if (!CONFLICT_START.test(lines[startLine] ?? '')) return null

  let index = startLine + 1
  const oursLines: string[] = []
  while (
    index < lines.length &&
    !CONFLICT_BASE.test(lines[index] ?? '') &&
    !CONFLICT_MID.test(lines[index] ?? '')
  ) {
    oursLines.push(lines[index] ?? '')
    index += 1
  }

  let baseLines: string[] | undefined
  if (index < lines.length && CONFLICT_BASE.test(lines[index] ?? '')) {
    baseLines = []
    index += 1
    while (index < lines.length && !CONFLICT_MID.test(lines[index] ?? '')) {
      baseLines.push(lines[index] ?? '')
      index += 1
    }
  }

  if (index >= lines.length || !CONFLICT_MID.test(lines[index] ?? '')) return null
  index += 1

  const theirsLines: string[] = []
  while (index < lines.length && !CONFLICT_END.test(lines[index] ?? '')) {
    theirsLines.push(lines[index] ?? '')
    index += 1
  }
  if (index >= lines.length || !CONFLICT_END.test(lines[index] ?? '')) return null

  const markerLine = lines[index] ?? ''
  const branchLabel = markerLine.replace(/^>>>>>>>\s*/, '').trim()
  const nextLine = index + 1
  return {
    hunk: {
      ours: oursLines.join('\n'),
      theirs: theirsLines.join('\n'),
      ...(baseLines ? { base: baseLines.join('\n') } : {}),
      branchLabel,
      startLine,
      endLine: nextLine,
    },
    nextLine,
  }
}

/** Parse complete Git conflict-marker blocks into ordered hunks. */
export function parseConflictHunks(source: string): ParsedConflictFile {
  const hunks: ConflictHunk[] = []
  const lines = source.split('\n')
  let index = 0

  while (index < lines.length) {
    if (!CONFLICT_START.test(lines[index] ?? '')) {
      index += 1
      continue
    }

    const parsed = parseHunkAt(lines, index)
    if (!parsed) {
      // A marker-looking line in prose or an incomplete block is not silently
      // consumed. Move one line and keep scanning for a later complete block.
      index += 1
      continue
    }

    hunks.push({ id: hunks.length, ...parsed.hunk })
    index = parsed.nextLine
  }

  return { hunks }
}

/** True only when every parsed hunk has an explicit, available resolution. */
export function areConflictChoicesComplete(
  parsed: ParsedConflictFile,
  choices: Partial<Record<number, ConflictHunkChoice>>,
): boolean {
  return (
    parsed.hunks.length > 0 &&
    parsed.hunks.every((hunk) => {
      const choice = choices[hunk.id]
      if (choice === 'base') return hunk.base !== undefined
      return choice === 'ours' || choice === 'theirs'
    })
  )
}

/**
 * Apply explicit per-hunk choices. Unresolved hunks are preserved verbatim so
 * callers can never accidentally turn an untouched conflict into an implicit
 * "ours" resolution.
 */
export function applyConflictChoices(
  source: string,
  choices: Partial<Record<number, ConflictHunkChoice>>,
): string {
  const parsed = parseConflictHunks(source)
  if (parsed.hunks.length === 0) return source

  const lines = source.split('\n')
  const output: string[] = []
  let cursor = 0

  for (const hunk of parsed.hunks) {
    output.push(...lines.slice(cursor, hunk.startLine))
    const choice = choices[hunk.id]
    if (choice === 'ours') {
      if (hunk.ours) output.push(...hunk.ours.split('\n'))
    } else if (choice === 'theirs') {
      if (hunk.theirs) output.push(...hunk.theirs.split('\n'))
    } else if (choice === 'base' && hunk.base !== undefined) {
      if (hunk.base) output.push(...hunk.base.split('\n'))
    } else {
      output.push(...lines.slice(hunk.startLine, hunk.endLine))
    }
    cursor = hunk.endLine
  }

  output.push(...lines.slice(cursor))
  return output.join('\n')
}
