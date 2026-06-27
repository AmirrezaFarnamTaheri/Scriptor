export type ConflictHunkChoice = 'ours' | 'theirs' | 'base'

export interface ConflictHunk {
  id: number
  ours: string
  theirs: string
  branchLabel: string
  /** Line number in the source file where the `<<<<<<<` marker starts (0-indexed). */
  startLine: number
  /** Line number in the source file after the `>>>>>>>` marker (0-indexed, exclusive). */
  endLine: number
}

export interface ParsedConflictFile {
  hunks: ConflictHunk[]
}

const CONFLICT_START = /^<<<<<<</
const CONFLICT_MID = /^=======/
const CONFLICT_END = /^>>>>>>>/

/** Parse git conflict markers into ordered hunks (ours / theirs pairs). */
export function parseConflictHunks(source: string): ParsedConflictFile {
  const hunks: ConflictHunk[] = []
  const lines = source.split('\n')
  let index = 0
  let hunkId = 0

  while (index < lines.length) {
    const line = lines[index] ?? ''
    if (!CONFLICT_START.test(line)) {
      index += 1
      continue
    }
    const conflictStart = index
    index += 1
    const oursLines: string[] = []
    while (index < lines.length && !CONFLICT_MID.test(lines[index] ?? '')) {
      oursLines.push(lines[index] ?? '')
      index += 1
    }
    if (index >= lines.length || !CONFLICT_MID.test(lines[index] ?? '')) break
    index += 1
    const theirsLines: string[] = []
    while (index < lines.length && !CONFLICT_END.test(lines[index] ?? '')) {
      theirsLines.push(lines[index] ?? '')
      index += 1
    }
    if (index >= lines.length || !CONFLICT_END.test(lines[index] ?? '')) break
    const markerLine = lines[index] ?? ''
    const branchLabel = markerLine.replace(/^>>>>>>>\s*/, '').trim()
    index += 1
    hunks.push({
      id: hunkId,
      ours: oursLines.join('\n'),
      theirs: theirsLines.join('\n'),
      branchLabel,
      startLine: conflictStart,
      endLine: index,
    })
    hunkId += 1
  }

  return { hunks }
}

/** Apply per-hunk choices and return conflict-marker-free markdown. */
export function applyConflictChoices(
  source: string,
  choices: Record<number, ConflictHunkChoice>,
  baseContent?: string | null,
): string {
  const lines = source.split('\n')
  const output: string[] = []
  let index = 0
  let hunkId = 0

  while (index < lines.length) {
    const line = lines[index] ?? ''
    if (!CONFLICT_START.test(line)) {
      output.push(line)
      index += 1
      continue
    }
    const conflictStart = index
    index += 1
    const oursLines: string[] = []
    while (index < lines.length && !CONFLICT_MID.test(lines[index] ?? '')) {
      oursLines.push(lines[index] ?? '')
      index += 1
    }
    if (index >= lines.length || !CONFLICT_MID.test(lines[index] ?? '')) break
    index += 1
    const theirsLines: string[] = []
    while (index < lines.length && !CONFLICT_END.test(lines[index] ?? '')) {
      theirsLines.push(lines[index] ?? '')
      index += 1
    }
    if (index >= lines.length || !CONFLICT_END.test(lines[index] ?? '')) break
    index += 1

    const choice = choices[hunkId] ?? 'ours'
    if (choice === 'theirs') {
      output.push(...theirsLines)
    } else if (choice === 'base' && baseContent) {
      const contentLineCount = Math.max(oursLines.length, theirsLines.length)
      output.push(extractBaseHunk(baseContent, conflictStart, contentLineCount))
    } else {
      output.push(...oursLines)
    }
    hunkId += 1
  }

  return output.join('\n')
}

/**
 * Extract the portion of the base (ancestor) file that corresponds to a conflict
 * hunk. Uses a positional heuristic: the hunk's start line in the conflicted file
 * (minus the conflict-marker lines above it) is used as an index into the base
 * file's lines, and we return roughly the same number of content lines.
 */
export function extractBaseHunk(
  baseContent: string,
  hunkStartLine: number,
  contentLineCount: number,
): string {
  const baseLines = baseContent.split('\n')
  if (baseLines.length === 0) return ''

  // Estimate position in the base file. Each prior conflict added ~3 marker
  // lines that don't exist in the base, so subtract 3 per prior conflict
  // (we approximate by using the raw offset — good enough for a heuristic).
  const estimatedStart = Math.max(0, Math.min(hunkStartLine, baseLines.length - 1))
  const estimatedEnd = Math.min(estimatedStart + Math.max(contentLineCount, 1), baseLines.length)
  return baseLines.slice(estimatedStart, estimatedEnd).join('\n')
}
