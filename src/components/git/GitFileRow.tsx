import React, { useId, useLayoutEffect, useRef } from 'react'
import type { GitChangedFile } from '../../types/vault'
import { useI18n } from '../../lib/i18n'

export interface GitFileRowProps {
  file: GitChangedFile
  isActive: boolean
  isSelected: boolean
  onToggleSelect: (path: string, selected: boolean) => void
  onOpenNote?: (path: string) => void
  onPreviewDiff?: (path: string) => void
  onResolveConflict?: (path: string) => void
  compact?: boolean
  onMeasureHeight?: (height: number) => void
  /** 1-based logical position in the full virtualized set. */
  positionInSet?: number
  /** Total logical rows, including unmounted virtual rows. */
  setSize?: number
  /** Positioning styles supplied by the windowed list container. */
  style?: React.CSSProperties
}

export const GitFileRow = React.memo(function GitFileRow({
  file,
  isActive,
  isSelected,
  onToggleSelect,
  onOpenNote,
  onPreviewDiff,
  onResolveConflict,
  compact = false,
  onMeasureHeight,
  positionInSet,
  setSize,
  style,
}: GitFileRowProps) {
  const { t } = useI18n()
  const checkboxId = useId()
  const contentRef = useRef<HTMLDivElement | null>(null)
  const isMarkdown = file.path.endsWith('.md')
  const noteLabel = file.path.replace(/\.md$/i, '').split(/[\\/]/).pop() ?? file.path

  useLayoutEffect(() => {
    const content = contentRef.current
    if (!content || !onMeasureHeight) return
    const measure = () => onMeasureHeight(content.offsetHeight)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(content)
    return () => observer.disconnect()
  }, [compact, onMeasureHeight])

  return (
    <li
      className={isActive ? 'git-file-active' : undefined}
      style={{ ...style, padding: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}
      aria-posinset={positionInSet}
      aria-setsize={setSize}
    >
      <div
        ref={contentRef}
        className={`git-file-row-content${compact ? ' git-file-row-content-compact' : ''}`}
      >
        <div className="git-file-selection">
          <input
            id={checkboxId}
            type="checkbox"
            checked={isSelected}
            onChange={(event) => onToggleSelect(file.path, event.target.checked)}
          />
          <label htmlFor={checkboxId}>
            <span title={file.path}>
              <span className="git-file-name">{isMarkdown ? noteLabel : file.path}</span>
              {isMarkdown ? <small className="git-file-path">{file.path}</small> : null}
            </span>
            <small>{file.conflict ? t('git.conflict') : file.status}</small>
          </label>
        </div>
        <div className="git-file-row-actions">
          {isMarkdown && onOpenNote ? (
            <button type="button" className="git-note-link" onClick={() => onOpenNote(file.path)}>
              {t('git.openNote')}
            </button>
          ) : null}
          {isMarkdown && onPreviewDiff ? (
            <button type="button" className="toolbar-button" onClick={() => onPreviewDiff(file.path)}>
              {t('git.previewDiff')}
            </button>
          ) : null}
          {file.conflict && onResolveConflict ? (
            <button
              type="button"
              className="conflict-resolve-btn"
              onClick={() => onResolveConflict(file.path)}
            >
              {t('git.resolve')}
            </button>
          ) : null}
        </div>
      </div>
    </li>
  )
})
