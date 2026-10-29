import { useCallback, useId, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { CheckCircle2, FolderOpen, ShieldAlert, X } from 'lucide-react'

import { vaultDetectObsidian, vaultImportObsidian } from '../bridge/commands/vault.ts'
import type { ObsidianImportResult } from '../bridge/commands/vault.ts'
import { useEscapeToClose } from '../hooks/useEscapeToClose'
import { useFocusTrap } from '../hooks/useFocusTrap'

interface ObsidianImportDialogProps {
  onClose: () => void
  onImported?: (result: ObsidianImportResult) => void
  vaultId: string | null
  /** The overlay owner persists this claim across same-vault dialog remounts. */
  importInFlightByVault: RefObject<Set<string>>
}

export function ObsidianImportDialog({ onClose, onImported, vaultId, importInFlightByVault }: ObsidianImportDialogProps) {
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
  const checkGeneration = useRef(0)
  const importInFlightRef = useRef(false)
  const importLifecycleRef = useRef(0)

  useLayoutEffect(() => {
    const lifecycle = ++importLifecycleRef.current
    return () => {
      // A closed or remounted dialog cannot publish an earlier native reply.
      if (importLifecycleRef.current === lifecycle) importLifecycleRef.current += 1
      checkGeneration.current += 1
    }
  }, [])

  useEscapeToClose(true, onClose)
  useFocusTrap(dialogRef, { active: true, initialFocus: false })

  const validateSource = useCallback(async (path: string) => {
    const check = ++checkGeneration.current
    if (!path.trim()) { setIsValid(null); setIsValidating(false); return }
    setIsValidating(true)
    setError(null)
    try {
      const detected = await vaultDetectObsidian(path.trim())
      if (check !== checkGeneration.current) return
      setIsValid(detected)
      if (!detected) setError('This folder does not contain an Obsidian vault (.obsidian).')
    } catch (caught) {
      if (check !== checkGeneration.current) return
      setIsValid(false)
      setError(caught instanceof Error ? caught.message : String(caught))
    } finally {
      if (check === checkGeneration.current) setIsValidating(false)
    }
  }, [])
  const handleValidate = useCallback(() => void validateSource(sourcePath), [sourcePath, validateSource])

  const handleBrowse = useCallback(async () => {
    // The native folder picker can outlive the dialog that opened it.
    // Never reopen a picker or validate its result for a destroyed overlay.
    const lifecycle = importLifecycleRef.current
    const { open } = await import('@tauri-apps/plugin-dialog')
    if (importLifecycleRef.current !== lifecycle) return
    const selection = await open({
      directory: true,
      multiple: false,
      title: 'Select Obsidian Vault',
    })
    if (!selection || importLifecycleRef.current !== lifecycle) return
    const path = Array.isArray(selection) ? selection[0] : selection
    setSourcePath(path)
    setIsValid(null)
    setError(null)
    // Selecting a folder is the user's intent to inspect it; no second
    // "Validate" click is required, and no files are changed.
    void validateSource(path)
  }, [validateSource])

  const handleImport = useCallback(async () => {
    // React busy state updates on a later render. Claim this dialog's native
    // mutation synchronously so a second submit cannot request authorization.
    if (importInFlightRef.current || !sourcePath.trim()) return
    if (!vaultId) {
      setError('Open a vault before importing.')
      return
    }
    if (importInFlightByVault.current.has(vaultId)) {
      setError('An import is already running for this vault. It can finish after the dialog closes.')
      return
    }
    importInFlightByVault.current.add(vaultId)
    importInFlightRef.current = true
    const lifecycle = importLifecycleRef.current
    const ownsDialog = () => importLifecycleRef.current === lifecycle
    setIsImporting(true)
    setError(null)
    setResult(null)
    try {
      const importResult = await vaultImportObsidian(sourcePath.trim(), vaultId, {
        convertWikilinks,
        importAttachments,
        preserveFrontmatter,
      })
      // A native import can complete even after this overlay closes. It must
      // not notify a subsequently selected vault or mutate an unmounted form.
      if (!ownsDialog()) return
      setResult(importResult)
      onImported?.(importResult)
    } catch (caught) {
      if (ownsDialog()) setError(String(caught))
    } finally {
      // Native settlement releases the shared vault claim, not dialog teardown.
      // The original native operation may still be running after an unmount.
      importInFlightByVault.current.delete(vaultId)
      importInFlightRef.current = false
      if (ownsDialog()) setIsImporting(false)
    }
  }, [sourcePath, convertWikilinks, importAttachments, preserveFrontmatter, onImported, vaultId, importInFlightByVault])

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
        className="rename-dialog obsidian-import-dialog" data-help-topic="import"
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
                checkGeneration.current += 1
                setSourcePath(event.target.value)
                setIsValid(null)
                setIsValidating(false)
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
              {isValidating ? 'Checking…' : 'Check folder'}
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
            <span>Keep note properties (YAML frontmatter)</span>
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
            <button type="submit" className="primary-button" disabled={isImporting || isValidating || isValid === false || !sourcePath.trim()}>
              {isImporting ? 'Importing…' : 'Import vault'}
            </button>
          ) : null}
        </div>
      </form>
    </div>
  )
}
