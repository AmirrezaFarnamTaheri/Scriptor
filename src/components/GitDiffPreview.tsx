import { buildLineDiff, summarizeDiff, type DiffLine } from '../lib/simpleDiff'

interface GitDiffPreviewProps {
  path: string
  before: string
  after: string
}

function DiffRow({ row }: { row: DiffLine }) {
  const prefix = row.kind === 'add' ? '+' : row.kind === 'remove' ? '-' : ' '
  const lineNo = row.kind === 'remove' ? row.oldLine : row.newLine
  return (
    <div className={`git-diff-line git-diff-${row.kind}`}>
      <span className="git-diff-lineno">{lineNo ?? ''}</span>
      <span className="git-diff-prefix">{prefix}</span>
      <code>{row.text || ' '}</code>
    </div>
  )
}

export function GitDiffPreview({ path, before, after }: GitDiffPreviewProps) {
  const rows = buildLineDiff(before, after)
  const summary = summarizeDiff(rows)
  const changedOnly = rows.filter((row) => row.kind !== 'same')

  return (
    <section className="git-diff-preview" aria-label={`Diff preview for ${path}`}>
      <header>
        <strong>{path}</strong>
        <small>HEAD vs working · +{summary.added} / -{summary.removed}</small>
      </header>
      {before === after ? (
        <p className="empty-state">No line changes detected for this note.</p>
      ) : changedOnly.length === 0 ? (
        <p className="empty-state">Whitespace-only changes.</p>
      ) : (
        <div className="git-diff-body">
          {changedOnly.map((row, index) => (
            <DiffRow key={`${row.kind}-${row.oldLine ?? row.newLine}-${index}`} row={row} />
          ))}
        </div>
      )}
    </section>
  )
}
