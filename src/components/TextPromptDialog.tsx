import { useEffect, useId, useRef } from 'react'

import type { TextPromptRequest } from '../hooks/useTextPrompt'

interface TextPromptDialogProps {
  request: TextPromptRequest
  onSubmit: (value: string) => void
  onCancel: () => void
}

export function TextPromptDialog({ request, onSubmit, onCancel }: TextPromptDialogProps) {
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [request.title])

  return (
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <form
        className="rename-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${inputId}-title`}
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault()
          const value = inputRef.current?.value ?? ''
          if (value.trim()) {
            onSubmit(value.trim())
          } else {
            onCancel()
          }
        }}
      >
        <header>
          <h2 id={`${inputId}-title`}>{request.title}</h2>
          <button type="button" className="icon-button" onClick={onCancel} aria-label="Close">
            ×
          </button>
        </header>

        <label className="rename-current-path" htmlFor={inputId}>
          {request.label}
        </label>
        <input
          id={inputId}
          ref={inputRef}
          className="toolbar-input"
          type="text"
          defaultValue={request.defaultValue}
          autoComplete="off"
        />

        <div className="rename-actions">
          <button type="button" className="toolbar-button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="primary-button">
            {request.submitLabel ?? 'Continue'}
          </button>
        </div>
      </form>
    </div>
  )
}
