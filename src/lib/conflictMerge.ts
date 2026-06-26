export type ConflictHunkChoice = 'ours' | 'theirs' | 'base'

export interface ConflictHunk {
  id: number
  ours: string
  theirs: string
  branchLabel: string
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
    const endLine = lines[index] ?? ''
    const branchLabel = endLine.replace(/^>>>>>>>\s*/, '').trim()
    index += 1
    hunks.push({
      id: hunkId,
      ours: oursLines.join('\n'),
      theirs: theirsLines.join('\n'),
      branchLabel,
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
      output.push(extractBaseHunk(baseContent, hunkId, oursLines.join('\n')))
    } else {
      output.push(...oursLines)
    }
    hunkId += 1
  }

  return output.join('\n')
}

function extractBaseHunk(baseContent: string, hunkIndex: number, oursFallback: string): string {
  const parsed = parseConflictHunks(baseContent)
  const match = parsed.hunks[hunkIndex]
  if (match) return match.ours
  return oursFallback
}
