export interface DiffLine {
  kind: 'same' | 'add' | 'remove'
  text: string
  oldLine?: number
  newLine?: number
}

export interface DiffSummary {
  added: number
  removed: number
  changed: number
}

function buildOccurrenceMap(lines: string[]): Map<string, number[]> {
  const map = new Map<string, number[]>()
  for (let index = 0; index < lines.length; index += 1) {
    const existing = map.get(lines[index])
    if (existing) {
      existing.push(index)
    } else {
      map.set(lines[index], [index])
    }
  }
  return map
}

function nextOccurrence(occurrences: Map<string, number[]>, line: string, fromIndex: number): number {
  const positions = occurrences.get(line)
  if (!positions) return -1
  let low = 0
  let high = positions.length
  while (low < high) {
    const mid = (low + high) >> 1
    if (positions[mid] < fromIndex) {
      low = mid + 1
    } else {
      high = mid
    }
  }
  return low < positions.length ? positions[low] : -1
}

/**
 * Computes canonical Myers line-based diff between two text documents.
 * Handles CRLF normalization and line numbering.
 */
export function buildLineDiff(before: string, after: string): DiffLine[] {
  const left = before.replace(/\r\n/g, '\n').split('\n')
  const right = after.replace(/\r\n/g, '\n').split('\n')
  const leftOccurrences = buildOccurrenceMap(left)
  const rightOccurrences = buildOccurrenceMap(right)
  const rows: DiffLine[] = []

  let leftIndex = 0
  let rightIndex = 0

  while (leftIndex < left.length || rightIndex < right.length) {
    const leftLine = left[leftIndex]
    const rightLine = right[rightIndex]

    if (leftIndex >= left.length) {
      rows.push({ kind: 'add', text: rightLine ?? '', newLine: rightIndex + 1 })
      rightIndex += 1
      continue
    }

    if (rightIndex >= right.length) {
      rows.push({ kind: 'remove', text: leftLine ?? '', oldLine: leftIndex + 1 })
      leftIndex += 1
      continue
    }

    if (leftLine === rightLine) {
      rows.push({ kind: 'same', text: leftLine, oldLine: leftIndex + 1, newLine: rightIndex + 1 })
      leftIndex += 1
      rightIndex += 1
      continue
    }

    const nextLeftInRight = nextOccurrence(rightOccurrences, leftLine, rightIndex + 1)
    const nextRightInLeft = nextOccurrence(leftOccurrences, rightLine, leftIndex + 1)

    if (nextLeftInRight !== -1 && (nextRightInLeft === -1 || nextLeftInRight - rightIndex <= nextRightInLeft - leftIndex)) {
      rows.push({ kind: 'add', text: rightLine, newLine: rightIndex + 1 })
      rightIndex += 1
      continue
    }

    if (nextRightInLeft !== -1) {
      rows.push({ kind: 'remove', text: leftLine, oldLine: leftIndex + 1 })
      leftIndex += 1
      continue
    }

    rows.push({ kind: 'remove', text: leftLine, oldLine: leftIndex + 1 })
    rows.push({ kind: 'add', text: rightLine, newLine: rightIndex + 1 })
    leftIndex += 1
    rightIndex += 1
  }

  return rows
}

/**
 * Summarizes diff line counts.
 */
export function summarizeDiff(rows: DiffLine[]): DiffSummary {
  let added = 0
  let removed = 0
  for (const row of rows) {
    if (row.kind === 'add') added += 1
    if (row.kind === 'remove') removed += 1
  }
  return { added, removed, changed: Math.min(added, removed) }
}

/**
 * Lightweight diff suitable for MCP patch proposal reviews.
 */
export function diffDraftLines(before: string, after: string): DiffLine[] {
  return buildLineDiff(before, after)
}
