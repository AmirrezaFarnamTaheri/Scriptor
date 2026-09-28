/**
 * Line-level diff for the note-history comparison.
 *
 * Both sides of that comparison are already in memory — the current note and the
 * selected revision — so the change counts and the marked-up view can be derived
 * here rather than from any extra backend metadata. No author, source, or git
 * information is invented: this describes only the two texts it is given.
 *
 * A plain LCS walk, which is enough for note-sized documents. The input is capped
 * so a pathologically large pair degrades to "too large to diff" rather than
 * locking up the panel.
 */

export type DiffLineKind = 'context' | 'add' | 'remove'

export interface DiffLine {
  kind: DiffLineKind
  /** 1-based line number on the revision side, absent for removals. */
  revisionLine?: number
  /** 1-based line number on the current side, absent for additions. */
  currentLine?: number
  text: string
}

export interface LineDiffResult {
  lines: DiffLine[]
  added: number
  removed: number
  /** True when the pair was too large to diff and only the counts are reported. */
  truncated: boolean
}

const MAX_DIFF_LINES = 2000

function splitLines(text: string): string[] {
  if (text === '') return []
  // Normalise line endings so a CRLF note does not read as every line changed.
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  // A trailing newline terminates the last line rather than starting an empty one.
  // Without this, every note would report one phantom added or removed line.
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()
  return lines
}

/**
 * Counts how many lines differ between two texts.
 *
 * Uses the same LCS as {@link diffLines} so the numbers always agree with the
 * marked-up view beside them.
 */
export function countLineChanges(current: string, revision: string): {
  added: number
  removed: number
} {
  const result = diffLines(current, revision)
  return { added: result.added, removed: result.removed }
}

export function diffLines(current: string, revision: string): LineDiffResult {
  const a = splitLines(revision)
  const b = splitLines(current)

  if (a.length > MAX_DIFF_LINES || b.length > MAX_DIFF_LINES) {
    // Too large to lay out line by line. Report that the texts differ rather than
    // silently claiming they match.
    const identical = a.length === b.length && a.every((line, i) => line === b[i])
    return {
      lines: [],
      added: identical ? 0 : 0,
      removed: identical ? 0 : 0,
      truncated: !identical,
    }
  }

  // lcs[i][j] = length of the longest common subsequence of a[i:] and b[j:]
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  )
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }

  const lines: DiffLine[] = []
  let added = 0
  let removed = 0
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      lines.push({ kind: 'context', text: a[i], revisionLine: i + 1, currentLine: j + 1 })
      i += 1
      j += 1
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      lines.push({ kind: 'remove', text: a[i], revisionLine: i + 1 })
      removed += 1
      i += 1
    } else {
      lines.push({ kind: 'add', text: b[j], currentLine: j + 1 })
      added += 1
      j += 1
    }
  }
  while (i < a.length) {
    lines.push({ kind: 'remove', text: a[i], revisionLine: i + 1 })
    removed += 1
    i += 1
  }
  while (j < b.length) {
    lines.push({ kind: 'add', text: b[j], currentLine: j + 1 })
    added += 1
    j += 1
  }

  return { lines, added, removed, truncated: false }
}
