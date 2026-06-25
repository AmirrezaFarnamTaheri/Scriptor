export interface DraftDiffLine {
  kind: 'same' | 'add' | 'remove'
  text: string
}

export function diffDraftLines(before: string, after: string): DraftDiffLine[] {
  const left = before.replace(/\r\n/g, '\n').split('\n')
  const right = after.replace(/\r\n/g, '\n').split('\n')
  const lines: DraftDiffLine[] = []
  const max = Math.max(left.length, right.length)

  for (let index = 0; index < max; index += 1) {
    const a = left[index]
    const b = right[index]
    if (a === b) {
      if (a !== undefined) lines.push({ kind: 'same', text: a })
      continue
    }
    if (a !== undefined) lines.push({ kind: 'remove', text: a })
    if (b !== undefined) lines.push({ kind: 'add', text: b })
  }

  return lines
}

export function runDiffTests(): string[] {
  const failures: string[] = []
  const diff = diffDraftLines('# A\nold', '# A\nnew')
  if (!diff.some((line) => line.kind === 'remove' && line.text === 'old')) {
    failures.push('diff should include removed line')
  }
  if (!diff.some((line) => line.kind === 'add' && line.text === 'new')) {
    failures.push('diff should include added line')
  }
  return failures
}
