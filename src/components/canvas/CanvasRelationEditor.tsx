import { useState } from 'react'
import type { CanvasRelation } from '@scriptor/core/contracts/canvas'

interface Props {
  connectorBlockId: string
  relation?: CanvasRelation
  activePath?: string | null
  onSave: (relation: CanvasRelation) => void
  onRemove: () => void
}

/** Authored endpoints are explicit; connector geometry is never interpreted as a link. */
export function CanvasRelationEditor({ connectorBlockId, relation, activePath, onSave, onRemove }: Props) {
  const [source, setSource] = useState(relation?.sourceNotePath ?? activePath ?? '')
  const [target, setTarget] = useState(relation?.targetNotePath ?? '')
  const [label, setLabel] = useState(relation?.label ?? 'supports')
  const [error, setError] = useState<string | null>(null)
  return <form className="canvas-relation-editor" aria-label="Connector note relation" onSubmit={(event) => {
    event.preventDefault()
    const paths = [source.trim(), target.trim()]
    if (paths.some((path) => !path.endsWith('.md') || path.startsWith('/') || path.includes('\\') || path.includes(':') || path.split('/').some((part) => !part || part === '..' || part === '.')) || !label.trim() || new TextEncoder().encode(label.trim()).length > 128) {
      setError('Enter vault-relative Markdown paths and a short relation label (at most 128 UTF-8 bytes).')
      return
    }
    setError(null)
    onSave({ id: relation?.id ?? crypto.randomUUID(), connectorBlockId, sourceNotePath: paths[0], targetNotePath: paths[1], label: label.trim() })
  }}>
    <label>From note<input value={source} maxLength={1024} onChange={(event) => setSource(event.target.value)} placeholder="Research/question.md" required /></label>
    <label>To note<input value={target} maxLength={1024} onChange={(event) => setTarget(event.target.value)} placeholder="Research/evidence.md" required /></label>
    <label>Relation<input value={label} maxLength={128} onChange={(event) => setLabel(event.target.value)} required /></label>
    <button type="submit">Save relation</button>
    {relation ? <button type="button" onClick={onRemove}>Remove relation</button> : null}
    {error ? <p role="alert">{error}</p> : null}
    <p>This connector contributes a Canvas relation to the graph. Markdown links stay authored in their notes.</p>
  </form>
}
