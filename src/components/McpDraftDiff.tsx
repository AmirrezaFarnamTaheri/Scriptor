import { diffDraftLines } from '@scriptor/mcp'

interface McpDraftDiffProps {
  before: string
  after: string
}

export function McpDraftDiff({ before, after }: McpDraftDiffProps) {
  const lines = diffDraftLines(before, after)

  return (
    <pre className="mcp-draft-diff" aria-label="Draft diff review">
      {lines.map((line, index) => (
        <div key={`${line.kind}-${index}`} className={`mcp-diff-line mcp-diff-${line.kind}`}>
          <span className="mcp-diff-prefix">{line.kind === 'add' ? '+' : line.kind === 'remove' ? '-' : ' '}</span>
          <span>{line.text}</span>
        </div>
      ))}
    </pre>
  )
}
