import { useCallback, useId, useRef, useState } from 'react'
import { CheckCircle2, FolderOpen, ShieldAlert, X } from 'lucide-react'

import { vaultDetectObsidian, vaultImportObsidian } from '../bridge/commands/vault.ts'
import type { ObsidianImportResult } from '../bridge/commands/vault.ts'
import { useEscapeToClose } from '../hooks/useEscapeToClose'
import { useFocusTrap } from '../hooks/useFocusTrap'

interface ObsidianImportDialogProps {
  onClose: () => void
  onImported?: (result: ObsidianImportResult) => void
}

export function ObsidianImportDialog({ onClose, onImported }: ObsidianImportDialogProps) {
  const dialogRef = useRef<HTMLFormElement>(null)
  const pathId = useId()
  const titleId = useId()
  const descriptionId = useId()
  const statusId = useId()
  const [sourcePath, setSourcePath] = useState('')
  const [convertWikilinks, setConvertWikilinks] = useState(true)
  const [importAttachments, setImportAttachments] = useState(true)
  const [preserveFrontmatter, setPreserveFrontmatter] = useState(true)
  const [isImporting, setIsImporting] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [isValid, setIsValid] = useState<boolean | null>(null)
  const [result, setResult] = useState<ObsidianImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEscapeToClose(true, onClose)
  useFocusTrap(dialogRef, { active: true, initialFocus: false })

  const handleValidate = useCallback(async () => {
    if (!sourcePath.trim()) return
    setIsValidating(true)
    setError(null)
    try {
      const detected = await vaultDetectObsidian(sourcePath.trim())
      setIsValid(detected)
      if (!detected) {
        setError('No .obsidian/ directory found at this path')
      }
    } catch (caught) {
      setIsValid(false)
      setError(String(caught))
    } finally {
      setIsValidating(false)
    }
  }, [sourcePath])

  const handleBrowse = useCallback(async () => {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const selection = await open({
      directory: true,
      multiple: false,
      title: 'Select Obsidian Vault',
    })
    if (!selection) return
    const path = Array.isArray(selection) ? selection[0] : selection
    setSourcePath(path)
    setIsValid(null)
    setError(null)
  }, [])

  const handleImport = useCallback(async () => {
    if (!sourcePath.trim()) return
    setIsImporting(true)
    setError(null)
    setResult(null)
    try {
      const importResult = await vaultImportObsidian(sourcePath.trim(), {
        convertWikilinks,
        importAttachments,
        preserveFrontmatter,
      })
      setResult(importResult)
      onImported?.(importResult)
    } catch (caught) {
      setError(String(caught))
    } finally {
      setIsImporting(false)
    }
  }, [sourcePath, convertWikilinks, importAttachments, preserveFrontmatter, onImported])

  const validationMessage = isValid === true
    ? 'Obsidian vault detected'
    : isValid === false
      ? 'This folder is not a valid Obsidian vault'
      : null

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose()
      }}
    >
      <form
        ref={dialogRef}
        className="rename-dialog obsidian-import-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={isImporting || isValidating}
        onSubmit={(event) => {
          event.preventDefault()
          void handleImport()
        }}
      >
        <header>
          <div className="obsidian-import-heading">
            <span className="obsidian-import-mark" aria-hidden="true">
              <FolderOpen />
            </span>
            <div>
              <h2 id={titleId}>Import Obsidian vault</h2>
              <p id={descriptionId}>Copy notes into the open Scriptor vault without modifying the source.</p>
            </div>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close import dialog">
            <X aria-hidden="true" />
          </button>
        </header>

        <div className="obsidian-import-source">
          <label className="rename-current-path" htmlFor={pathId}>
            Source folder
          </label>
          <div className="obsidian-import-path-row">
            <input
              id={pathId}
              className="toolbar-input"
              type="text"
              value={sourcePath}
              onChange={(event) => {
                setSourcePath(event.target.value)
                setIsValid(null)
                setError(null)
              }}
              placeholder="/path/to/obsidian-vault"
              autoComplete="off"
              autoFocus
              aria-describedby={statusId}
            />
            <button type="button" className="toolbar-button" onClick={() => void handleBrowse()}>
              Browse
            </button>
            <button
              type="button"
              className="toolbar-button"
              onClick={() => void handleValidate()}
              disabled={isValidating || !sourcePath.trim()}
            >
              {isValidating ? 'Checking…' : 'Validate'}
            </button>
          </div>
          <div id={statusId} className="obsidian-import-status" aria-live="polite">
            {validationMessage ? (
              <p className={isValid ? 'is-success' : 'is-error'}>
                {isValid ? <CheckCircle2 aria-hidden="true" /> : <ShieldAlert aria-hidden="true" />}
                {validationMessage}
              </p>
            ) : null}
          </div>
        </div>

        <fieldset className="obsidian-import-options">
          <legend>Import options</legend>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={convertWikilinks}
              onChange={(event) => setConvertWikilinks(event.target.checked)}
            />
            <span>Convert wikilinks, highlights, and callouts</span>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={importAttachments}
              onChange={(event) => setImportAttachments(event.target.checked)}
            />
            <span>Copy images, PDFs, and other attachments</span>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={preserveFrontmatter}
              onChange={(event) => setPreserveFrontmatter(event.target.checked)}
            />
            <span>Preserve YAML frontmatter</span>
          </label>
        </fieldset>

        {error ? (
          <p className="obsidian-import-error" role="alert">
            <ShieldAlert aria-hidden="true" />
            {error}
          </p>
        ) : null}

        {result ? (
          <section className="rename-preview obsidian-import-result" aria-live="polite">
            <div className="obsidian-import-result-heading">
              <CheckCircle2 aria-hidden="true" />
              <strong>Import complete</strong>
            </div>
            <dl className="obsidian-import-metrics">
              <div><dt>Notes</dt><dd>{result.notesImported}</dd></div>
              <div><dt>Attachments</dt><dd>{result.attachmentsImported}</dd></div>
              <div><dt>Skipped</dt><dd>{result.skippedFiles}</dd></div>
            </dl>
            {result.errors.length > 0 ? (
              <details className="obsidian-import-result-errors">
                <summary>{result.errors.length} import error{result.errors.length === 1 ? '' : 's'}</summary>
                <ul>
                  {result.errors.slice(0, 10).map((message) => <li key={message}>{message}</li>)}
                  {result.errors.length > 10 ? <li>…and {result.errors.length - 10} more</li> : null}
                </ul>
              </details>
            ) : null}
          </section>
        ) : null}

        <div className="rename-actions">
          <button type="button" className="toolbar-button" onClick={onClose}>
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result ? (
            <button type="submit" className="primary-button" disabled={isImporting || !sourcePath.trim()}>
              {isImporting ? 'Importing…' : 'Import vault'}
            </button>
          ) : null}
        </div>
      </form>
    </div>
  )
}
