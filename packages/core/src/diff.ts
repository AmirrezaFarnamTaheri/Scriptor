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

/**
 * Computes a minimum-edit line diff using an LCS dynamic-programming table.
 * Handles CRLF normalization and line numbering.
 */
export function buildLineDiff(before: string, after: string): DiffLine[] {
  const left = before.replace(/\r\n/g, '\n').split('\n')
  const right = after.replace(/\r\n/g, '\n').split('\n')
  const width = right.length + 1
  const table = new Int32Array((left.length + 1) * width)

  for (let leftIndex = left.length - 1; leftIndex >= 0; leftIndex -= 1) {
    for (let rightIndex = right.length - 1; rightIndex >= 0; rightIndex -= 1) {
      const offset = leftIndex * width + rightIndex
      table[offset] = left[leftIndex] === right[rightIndex]
        ? table[(leftIndex + 1) * width + rightIndex + 1] + 1
        : Math.max(table[(leftIndex + 1) * width + rightIndex], table[leftIndex * width + rightIndex + 1])
    }
  }
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

    const dropLeft = table[(leftIndex + 1) * width + rightIndex]
    const addRight = table[leftIndex * width + rightIndex + 1]
    if (dropLeft >= addRight) {
      rows.push({ kind: 'remove', text: leftLine, oldLine: leftIndex + 1 })
      leftIndex += 1
      continue
    }
    rows.push({ kind: 'add', text: rightLine, newLine: rightIndex + 1 })
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
