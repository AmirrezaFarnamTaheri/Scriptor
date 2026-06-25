import { useState } from 'react'
import { X } from 'lucide-react'

interface ConflictResolverModalProps {
  path: string
  preview: string[]
  onResolve: (strategy: 'ours' | 'theirs') => void
  onClose: () => void
  isBusy: boolean
}

export function ConflictResolverModal({
  path,
  preview,
  onResolve,
  onClose,
  isBusy,
}: ConflictResolverModalProps) {
  const [strategy, setStrategy] = useState<'ours' | 'theirs'>('ours')

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="conflict-resolver" role="dialog" aria-label="Resolve merge conflict" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>Resolve conflict</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </header>
        <p>
          <strong>{path}</strong> has merge conflict markers. Choose which side to keep.
        </p>
        {preview.length >= 2 && (
          <div className="conflict-preview-grid">
            <article>
              <h3>Ours</h3>
              <pre>{preview[0]}</pre>
            </article>
            <article>
              <h3>Theirs</h3>
              <pre>{preview[1]}</pre>
            </article>
          </div>
        )}
        <fieldset>
          <legend>Resolution strategy</legend>
          <label>
            <input
              type="radio"
              name="conflict-strategy"
              checked={strategy === 'ours'}
              onChange={() => setStrategy('ours')}
            />
            Keep ours
          </label>
          <label>
            <input
              type="radio"
              name="conflict-strategy"
              checked={strategy === 'theirs'}
              onChange={() => setStrategy('theirs')}
            />
            Keep theirs
          </label>
        </fieldset>
        <footer>
          <button type="button" className="toolbar-button" disabled={isBusy} onClick={() => onResolve(strategy)}>
            Apply resolution
          </button>
        </footer>
      </section>
    </div>
  )
}
