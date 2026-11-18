/** An aligned, presentation-only comparison. Original text is never normalized or written back. */
export type ReviewDiffRow = {
  local: string | null
  remote: string | null
  kind: 'equal' | 'added' | 'removed' | 'changed'
}
export interface ReviewDiff {
  rows: ReviewDiffRow[]
  summary: { added: number; removed: number; changed: number }
  /** Large files use a conservative prefix/suffix comparison to bound work. */
  simplified: boolean
}

const MAX_ALIGNMENT_CELLS = 160_000

export function alignReviewedSource(local: string, remote: string): ReviewDiff {
  const left = local.split(/\r\n|\r|\n/)
  const right = remote.split(/\r\n|\r|\n/)
  const rows: ReviewDiffRow[] = []
  const summary = { added: 0, removed: 0, changed: 0 }
  let first = 0
  while (first < left.length && first < right.length && left[first] === right[first]) {
    rows.push({ local: left[first], remote: right[first], kind: 'equal' })
    first++
  }
  let lastLeft = left.length, lastRight = right.length
  while (lastLeft > first && lastRight > first && left[lastLeft - 1] === right[lastRight - 1]) {
    lastLeft--
    lastRight--
  }
  const n = lastLeft - first, m = lastRight - first
  const simplified = n * m > MAX_ALIGNMENT_CELLS
  const operations: Array<{ kind: 'equal' | 'removed' | 'added'; value: string }> = []
  if (simplified) {
    for (let i = first; i < lastLeft; i++) operations.push({ kind: 'removed', value: left[i] })
    for (let j = first; j < lastRight; j++) operations.push({ kind: 'added', value: right[j] })
  } else {
    const width = m + 1
    const table = new Uint32Array((n + 1) * width)
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        const cell = i * width + j
        table[cell] = left[first + i] === right[first + j]
          ? table[(i + 1) * width + j + 1] + 1
          : Math.max(table[(i + 1) * width + j], table[cell + 1])
      }
    }
    let i = 0, j = 0
    while (i < n || j < m) {
      if (i < n && j < m && left[first + i] === right[first + j]) {
        operations.push({ kind: 'equal', value: left[first + i] })
        i++
        j++
      } else if (i < n && (j === m || table[(i + 1) * width + j] >= table[i * width + j + 1])) {
        operations.push({ kind: 'removed', value: left[first + i] })
        i++
      } else {
        operations.push({ kind: 'added', value: right[first + j] })
        j++
      }
    }
  }

  let removed: string[] = [], added: string[] = []
  const flush = () => {
    for (let i = 0; i < Math.max(removed.length, added.length); i++) {
      const localLine = removed[i] ?? null, remoteLine = added[i] ?? null
      const kind = localLine !== null && remoteLine !== null ? 'changed' : localLine !== null ? 'removed' : 'added'
      rows.push({ local: localLine, remote: remoteLine, kind })
      summary[kind]++
    }
    removed = []
    added = []
  }
  for (const operation of operations) {
    if (operation.kind === 'equal') {
      flush()
      rows.push({ local: operation.value, remote: operation.value, kind: 'equal' })
    } else if (operation.kind === 'removed') removed.push(operation.value)
    else added.push(operation.value)
  }
  flush()
  for (let i = lastLeft; i < left.length; i++) {
    rows.push({ local: left[i], remote: right[lastRight + i - lastLeft], kind: 'equal' })
  }
  return { rows, summary, simplified }
}

/** Detect source formatting that an aligned, text-only line comparison cannot display. */
export function sourceLineEndingStyle(text: string): 'none' | 'LF' | 'CRLF' | 'CR' | 'mixed' {
  const endings = text.match(/\r\n|\r|\n/g)
  if (!endings?.length) return 'none'
  const kinds = new Set(endings.map(ending => ending === '\r\n' ? 'CRLF' : ending === '\r' ? 'CR' : 'LF'))
  return kinds.size === 1 ? ([...kinds][0] as 'LF' | 'CRLF' | 'CR') : 'mixed'
}
