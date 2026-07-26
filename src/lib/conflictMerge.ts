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

/** Opening/closing token of a fenced code block (``` or ~~~, three or more). */
const FENCE = /^(`{3,}|~{3,})/

/**
 * Tracks fenced-code-block state across a line scan so conflict markers that
 * appear *inside* a fence (e.g. a note documenting `git` usage) are treated as
 * ordinary text rather than real conflict markers. A fence opened with ``` can
 * only be closed by ```, and likewise for ~~~.
 */
class FenceTracker {
  private openChar: '`' | '~' | null = null

  /** Feed a line; returns true when the line is a fence delimiter. */
  push(line: string): boolean {
    const match = FENCE.exec(line.trim())
    if (!match) return false
    const char = match[1][0] as '`' | '~'
    if (this.openChar === null) {
      this.openChar = char
      return true
    }
    if (this.openChar === char) {
      this.openChar = null
      return true
    }
    // A ~~~ line inside a ``` fence (or vice versa) is just fenced content.
    return false
  }

  get inFence(): boolean {
    return this.openChar !== null
  }
}

/** Parse git conflict markers into ordered hunks (ours / theirs pairs). */
export function parseConflictHunks(source: string): ParsedConflictFile {
  const hunks: ConflictHunk[] = []
  const lines = source.split('\n')
  const fence = new FenceTracker()
  let index = 0
  let hunkId = 0

  while (index < lines.length) {
    const line = lines[index] ?? ''
    if (fence.push(line) || fence.inFence || !CONFLICT_START.test(line)) {
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

function lineCount(block: string): number {
  return block === '' ? 0 : block.split('\n').length
}

/**
 * How far the conflicted file has drifted from the base file after a conflict
 * block: the conflicted file spends 3 marker lines plus *both* sides, where the
 * base file held only the ancestor text (estimated as the longer side).
 */
function conflictDrift(oursLineCount: number, theirsLineCount: number): number {
  const conflicted = 3 + oursLineCount + theirsLineCount
  const base = Math.max(oursLineCount, theirsLineCount, 1)
  return conflicted - base
}

/**
 * Estimate the line in the base (ancestor) file where a hunk's ancestor content
 * begins, correcting for the marker and duplicate-side lines contributed by all
 * preceding conflicts. Callers pass the result to {@link extractBaseHunk}.
 */
export function estimateBaseHunkStart(hunks: ConflictHunk[], hunkId: number): number {
  let drift = 0
  for (const prior of hunks) {
    if (prior.id >= hunkId) break
    drift += conflictDrift(lineCount(prior.ours), lineCount(prior.theirs))
  }
  const hunk = hunks.find((candidate) => candidate.id === hunkId)
  return Math.max(0, (hunk?.startLine ?? 0) - drift)
}

/** Apply per-hunk choices and return conflict-marker-free markdown. */
export function applyConflictChoices(
  source: string,
  choices: Record<number, ConflictHunkChoice>,
  baseContent?: string | null,
): string {
  const lines = source.split('\n')
  const output: string[] = []
  const fence = new FenceTracker()
  let index = 0
  let hunkId = 0
  // Running offset between the conflicted file and the base file, accumulated
  // from every conflict resolved so far.
  let drift = 0

  while (index < lines.length) {
    const line = lines[index] ?? ''
    if (fence.push(line) || fence.inFence || !CONFLICT_START.test(line)) {
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
    if (index >= lines.length || !CONFLICT_MID.test(lines[index] ?? '')) {
      // Unbalanced markers: emit the remainder verbatim rather than truncating
      // the file. The user still sees the raw markers and can fix them by hand.
      output.push(...lines.slice(conflictStart))
      break
    }
    index += 1
    const theirsLines: string[] = []
    while (index < lines.length && !CONFLICT_END.test(lines[index] ?? '')) {
      theirsLines.push(lines[index] ?? '')
      index += 1
    }
    if (index >= lines.length || !CONFLICT_END.test(lines[index] ?? '')) {
      output.push(...lines.slice(conflictStart))
      break
    }
    index += 1

    const choice = choices[hunkId] ?? 'ours'
    if (choice === 'theirs') {
      output.push(...theirsLines)
    } else if (choice === 'base' && baseContent) {
      const contentLineCount = Math.max(oursLines.length, theirsLines.length)
      output.push(
        extractBaseHunk(baseContent, Math.max(0, conflictStart - drift), contentLineCount),
      )
    } else {
      output.push(...oursLines)
    }
    drift += conflictDrift(oursLines.length, theirsLines.length)
    hunkId += 1
  }

  return output.join('\n')
}

/**
 * Extract the portion of the base (ancestor) file that corresponds to a conflict
 * hunk. Uses a positional heuristic: `baseStartLine` is an index into the base
 * file's lines and we return roughly the same number of content lines.
 *
 * `baseStartLine` must already be corrected for preceding conflicts — use
 * {@link estimateBaseHunkStart} rather than passing a raw conflicted-file line
 * number, otherwise the 2nd and later hunks read from the wrong offset.
 */
export function extractBaseHunk(
  baseContent: string,
  baseStartLine: number,
  contentLineCount: number,
): string {
  const baseLines = baseContent.split('\n')
  if (baseLines.length === 0) return ''

  const estimatedStart = Math.max(0, Math.min(baseStartLine, baseLines.length - 1))
  const estimatedEnd = Math.min(estimatedStart + Math.max(contentLineCount, 1), baseLines.length)
  return baseLines.slice(estimatedStart, estimatedEnd).join('\n')
}
