import { buildLineDiff, type DiffLine } from '@scriptor/core'

export type DraftDiffLine = DiffLine

export function diffDraftLines(before: string, after: string): DraftDiffLine[] {
  return buildLineDiff(before, after)
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
