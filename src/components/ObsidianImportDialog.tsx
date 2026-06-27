import { useCallback, useId, useState } from 'react'

import { vaultDetectObsidian, vaultImportObsidian } from '../bridge/commands/vault.ts'
import type { ObsidianImportResult } from '../bridge/commands/vault.ts'

interface ObsidianImportDialogProps {
  onClose: () => void
  onImported?: (result: ObsidianImportResult) => void
}

export function ObsidianImportDialog({ onClose, onImported }: ObsidianImportDialogProps) {
  const pathId = useId()
  const [sourcePath, setSourcePath] = useState('')
  const [convertWikilinks, setConvertWikilinks] = useState(true)
  const [importAttachments, setImportAttachments] = useState(true)
  const [preserveFrontmatter, setPreserveFrontmatter] = useState(true)
  const [isImporting, setIsImporting] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [isValid, setIsValid] = useState<boolean | null>(null)
  const [result, setResult] = useState<ObsidianImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

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
    } catch (err) {
      setIsValid(false)
      setError(String(err))
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
    if (selection) {
      const path = Array.isArray(selection) ? selection[0] : selection
      setSourcePath(path)
      setIsValid(null)
    }
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
    } catch (err) {
      setError(String(err))
    } finally {
      setIsImporting(false)
    }
  }, [sourcePath, convertWikilinks, importAttachments, preserveFrontmatter, onImported])

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <form
        className="rename-dialog"
        role="dialog"
        aria-label="Import Obsidian Vault"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault()
          handleImport()
        }}
      >
        <header>
          <h2>Import Obsidian Vault</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </header>

        <label className="rename-current-path" htmlFor={pathId}>
          Source path
        </label>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            id={pathId}
            className="toolbar-input"
            type="text"
            value={sourcePath}
            onChange={(event) => {
              setSourcePath(event.target.value)
              setIsValid(null)
            }}
            placeholder="/path/to/obsidian-vault"
            autoComplete="off"
            style={{ flex: 1 }}
          />
          <button type="button" className="toolbar-button" onClick={handleBrowse}>
            Browse
          </button>
          <button
            type="button"
            className="toolbar-button"
            onClick={handleValidate}
            disabled={isValidating || !sourcePath.trim()}
          >
            {isValidating ? 'Checking...' : 'Validate'}
          </button>
        </div>

        {isValid === true && (
          <p style={{ color: 'var(--color-success, #16a34a)', margin: '0.5rem 0 0', fontSize: '0.85rem' }}>
            Obsidian vault detected
          </p>
        )}
        {isValid === false && (
          <p style={{ color: 'var(--color-error, #dc2626)', margin: '0.5rem 0 0', fontSize: '0.85rem' }}>
            Not an Obsidian vault
          </p>
        )}

        <fieldset style={{ border: 'none', padding: '0.75rem 0 0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <legend style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Import options</legend>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
            <input
              type="checkbox"
              checked={convertWikilinks}
              onChange={(event) => setConvertWikilinks(event.target.checked)}
            />
            Convert Obsidian syntax (wikilinks, ==highlights==, callouts)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
            <input
              type="checkbox"
              checked={importAttachments}
              onChange={(event) => setImportAttachments(event.target.checked)}
            />
            Copy attachments (images, PDFs)
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
            <input
              type="checkbox"
              checked={preserveFrontmatter}
              onChange={(event) => setPreserveFrontmatter(event.target.checked)}
            />
            Preserve YAML frontmatter
          </label>
        </fieldset>

        {error && (
          <p style={{ color: 'var(--color-error, #dc2626)', margin: '0.75rem 0 0', fontSize: '0.85rem' }}>
            {error}
          </p>
        )}

        {result && (
          <div className="rename-preview" style={{ marginTop: '0.75rem' }}>
            <strong>Import complete</strong>
            <ul>
              <li>{result.notesImported} notes imported</li>
              <li>{result.attachmentsImported} attachments imported</li>
              <li>{result.skippedFiles} files skipped</li>
            </ul>
            {result.errors.length > 0 && (
              <>
                <p style={{ color: 'var(--color-error, #dc2626)' }}>
                  {result.errors.length} error{result.errors.length === 1 ? '' : 's'}:
                </p>
                <ul>
                  {result.errors.slice(0, 10).map((err) => (
                    <li key={err} style={{ fontSize: '0.8rem' }}>{err}</li>
                  ))}
                  {result.errors.length > 10 && (
                    <li style={{ fontSize: '0.8rem' }}>...and {result.errors.length - 10} more</li>
                  )}
                </ul>
              </>
            )}
          </div>
        )}

        <div className="rename-actions">
          <button type="button" className="toolbar-button" onClick={onClose}>
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (
            <button
              type="submit"
              className="primary-button"
              disabled={isImporting || !sourcePath.trim()}
            >
              {isImporting ? 'Importing...' : 'Import'}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
