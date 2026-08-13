/**
 * ReaderPanel — PDF and EPUB viewer with annotation support (W3-8, D7).
 *
 * Architecture decisions:
 * - pdf.js and epub.js run inside a sandboxed <webview> / <iframe> via a local
 *   server-less blob URL — no `pdfium`, no new native dependency per D7.
 * - The reader↔component communication is postMessage across the webview
 *   boundary; the component is never coupled to the pdf.js API directly.
 * - All mutable reader state lives in `useReaderStore` (Zustand+immer) so
 *   commands and external code can drive navigation without touching the DOM.
 * - Annotation writes go through the store → `onAnnotationCreate` callback →
 *   caller uses `packages/core/src/capture/` → vault I-1 write path.
 *
 * D2 decomposition: I/O in `useReaderFile`, state in `useReaderStore`,
 * annotation UI in `AnnotationPopover`, rendering here only.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { BookOpen, ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react'

import { UnifiedPanelShell } from '../chrome/UnifiedPanelShell'
import type { PanelPresentation } from '../../hooks/usePanelPresentation'
import { useReaderStore, type ReaderAnnotation } from './useReaderStore'
import { useReaderFile } from './useReaderFile'
import { AnnotationPopover } from './AnnotationPopover'
import {
  loadReaderAnnotations,
  saveReaderAnnotations,
  type ReaderAnnotationRecord,
} from '../../bridge/reader'
import { createReaderAnnotationSaveQueue } from './createAnnotationSaveQueue'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ReaderPanelProps {
  /** Vault-relative path to the PDF or EPUB file to display. */
  filePath: string | null
  /** Absolute vault root — used to resolve `filePath` via the Tauri bridge. */
  vaultRoot: string | null
  presentation?: PanelPresentation
  onClose: () => void
  /** Called when the user creates a new annotation; caller persists it. */
  onAnnotationCreate?: (annotation: ReaderAnnotation) => void
}

// ── PDF.js / epub.js webview URLs (bundled under /reader/) ───────────────────
// The app ships static html wrappers under src/assets/reader/:
//   - pdf-viewer.html — loads pdf.js from the bundled pdfjs-dist assets
//   - epub-viewer.html — loads epub.js
// These communicate back via postMessage.
const PDF_VIEWER_URL = '/reader/pdf-viewer.html'
const EPUB_VIEWER_URL = '/reader/epub-viewer.html'
const READER_ORIGIN = window.location.origin

// ── Postmessage protocol ──────────────────────────────────────────────────────
// Outbound (component → webview):
//   { type: 'LOAD_BYTES', bytes: ArrayBuffer }
//   { type: 'GOTO', position: string }
//   { type: 'ZOOM', delta: number }
//   { type: 'HIGHLIGHT', annotation: ReaderAnnotation }
//
// Inbound (webview → component):
//   { type: 'READY' }
//   { type: 'POSITION', position: string }
//   { type: 'SELECTION', anchor: string, quote: string }
//   { type: 'SELECTION_CLEAR' }
//   { type: 'ERROR', message: string }

// ── Component ─────────────────────────────────────────────────────────────────

export function ReaderPanel({
  filePath,
  vaultRoot,
  presentation = 'dock-right',
  onClose,
  onAnnotationCreate,
}: ReaderPanelProps) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [webviewReady, setWebviewReady] = useState(false)

  // ── Store ──────────────────────────────────────────────────────────────────
  const {
    fileType,
    position,
    selection,
    annotations,
    annotationPopoverOpen,
    isLoading,
    error,
    openFile,
    closeFile,
    setPosition,
    setSelection,
    addAnnotation,
    setAnnotations,
    openAnnotationPopover,
    closeAnnotationPopover,
    setLoading,
    setError,
  } = useReaderStore()

  const annotationSaveQueue = useMemo(
    () =>
    createReaderAnnotationSaveQueue({
      saveAnnotations: saveReaderAnnotations,
      onPersisted: (annotation) => onAnnotationCreate?.(annotation as ReaderAnnotation),
      onError: (cause) => setError(`Could not save annotation: ${messageFor(cause)}`),
    }),
    [onAnnotationCreate, setError],
  )

  useEffect(() => {
    annotationSaveQueue.reset()
    return () => annotationSaveQueue.reset()
  }, [annotationSaveQueue, filePath])

  // ── File I/O ───────────────────────────────────────────────────────────────
  const fileState = useReaderFile(filePath, vaultRoot)

  useEffect(() => {
    if (!filePath || !vaultRoot) return
    let cancelled = false
    void loadReaderAnnotations(filePath)
      .then((saved) => {
        if (!cancelled) setAnnotations(saved as ReaderAnnotation[])
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(`Could not load annotations: ${messageFor(cause)}`)
      })
    return () => { cancelled = true }
  }, [filePath, vaultRoot, setAnnotations, setError])

  // Open file in the store when the prop changes.
  useEffect(() => {
    if (!filePath) {
      closeFile()
      return
    }
    const ext = filePath.split('.').pop()?.toLowerCase()
    const ft = ext === 'pdf' ? 'pdf' : ext === 'epub' ? 'epub' : 'unknown'
    openFile(filePath, ft)
  }, [filePath, closeFile, openFile])

  // Forward bytes to the webview once both the frame and bytes are ready.
  useEffect(() => {
    if (!webviewReady || fileState.status !== 'ready' || !frameRef.current?.contentWindow) return
    const bytes = fileState.bytes.slice()
    frameRef.current.contentWindow.postMessage(
      { type: 'LOAD_BYTES', bytes: bytes.buffer },
      READER_ORIGIN,
      [bytes.buffer],
    )
  }, [webviewReady, fileState])

  useEffect(() => {
    if (fileState.status === 'error') setError(fileState.message)
  }, [fileState, setError])

  // ── Postmessage listener ───────────────────────────────────────────────────
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.source !== frameRef.current?.contentWindow) return
      const msg = e.data as { type: string; [k: string]: unknown }
      switch (msg.type) {
        case 'READY':
          setWebviewReady(true)
          break
        case 'LOADED':
          setLoading(false)
          break
        case 'POSITION':
          setPosition(String(msg.position ?? ''))
          break
        case 'SELECTION':
          setSelection({ anchor: String(msg.anchor), quote: String(msg.quote) })
          openAnnotationPopover()
          break
        case 'SELECTION_CLEAR':
          setSelection(null)
          break
        case 'ERROR':
          setError(String(msg.message))
          break
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [setPosition, setSelection, setError, setLoading, openAnnotationPopover])

  // Re-highlight existing annotations whenever webview becomes ready.
  useEffect(() => {
    if (!webviewReady || !frameRef.current?.contentWindow) return
    for (const ann of annotations) {
      frameRef.current.contentWindow.postMessage({ type: 'HIGHLIGHT', annotation: ann }, READER_ORIGIN)
    }
  }, [webviewReady, annotations])

  // ── Navigation helpers ────────────────────────────────────────────────────
  const sendMsg = useCallback((msg: object) => {
    frameRef.current?.contentWindow?.postMessage(msg, READER_ORIGIN)
  }, [])

  const handlePrev = useCallback(() => sendMsg({ type: 'GOTO', position: 'prev' }), [sendMsg])
  const handleNext = useCallback(() => sendMsg({ type: 'GOTO', position: 'next' }), [sendMsg])
  const handleZoomIn = useCallback(() => sendMsg({ type: 'ZOOM', delta: +0.25 }), [sendMsg])
  const handleZoomOut = useCallback(() => sendMsg({ type: 'ZOOM', delta: -0.25 }), [sendMsg])

  // ── Annotation creation ───────────────────────────────────────────────────
  const handleAnnotate = useCallback(
    (partial: Omit<ReaderAnnotation, 'id' | 'createdAt'>) => {
      if (!filePath) {
        setError('Could not save annotation: no reader document is open.')
        return
      }

      const annotation: ReaderAnnotation = {
        ...partial,
        id: `ann-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        createdAt: new Date().toISOString(),
      }

      addAnnotation(annotation)
      sendMsg({ type: 'HIGHLIGHT', annotation })

      const nextAnnotations = [
        ...useReaderStore.getState().annotations,
      ] as ReaderAnnotationRecord[]
      annotationSaveQueue.enqueue(filePath, nextAnnotations, annotation)
    },
    [addAnnotation, annotationSaveQueue, filePath, sendMsg, setError],
  )

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'ArrowLeft') handlePrev()
      if (e.key === 'ArrowRight') handleNext()
      if (e.key === '+' || e.key === '=') handleZoomIn()
      if (e.key === '-') handleZoomOut()
    },
    [handlePrev, handleNext, handleZoomIn, handleZoomOut],
  )

  // ── Derived ────────────────────────────────────────────────────────────────
  const viewerSrc = fileType === 'epub' ? EPUB_VIEWER_URL : PDF_VIEWER_URL
  const fileLabel = filePath ? filePath.split('/').pop() ?? filePath : 'No file open'

  return (
    <UnifiedPanelShell
      title="Reader"
      subtitle={fileLabel}
      icon={<BookOpen size={18} />}
      ariaLabel="Document reader"
      onClose={onClose}
      presentation={presentation}
      wide
      className="reader-panel"
      headerActions={
        filePath ? (
          <div className="reader-panel__nav" aria-label="Reader controls">
            <button
              type="button"
              className="reader-panel__nav-btn"
              aria-label="Previous page"
              onClick={handlePrev}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              className="reader-panel__nav-btn"
              aria-label="Next page"
              onClick={handleNext}
            >
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              className="reader-panel__nav-btn"
              aria-label="Zoom out"
              onClick={handleZoomOut}
            >
              <ZoomOut size={16} />
            </button>
            <button
              type="button"
              className="reader-panel__nav-btn"
              aria-label="Zoom in"
              onClick={handleZoomIn}
            >
              <ZoomIn size={16} />
            </button>
            <span className="reader-panel__position" aria-live="polite" aria-label="Position">
              {position ?? '—'}
            </span>
          </div>
        ) : null
      }
    >
      <div
        className={`reader-panel__body${annotationPopoverOpen ? ' reader-panel__body--popover-open' : ''}`}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      >
        {/* Loading skeleton */}
        {isLoading && (
          <div className="reader-panel__loading" role="status" aria-label="Loading document">
            <div className="reader-panel__skeleton" />
          </div>
        )}

        {/* Error state */}
        {error && !isLoading && (
          <div className="reader-panel__error" role="alert">
            <X size={20} />
            <p>{error}</p>
          </div>
        )}

        {/* Empty state */}
        {!filePath && !isLoading && !error && (
          <div className="reader-panel__empty">
            <BookOpen size={40} aria-hidden />
            <p>Open a PDF or EPUB from the vault sidebar.</p>
          </div>
        )}

        {/* Viewer webview iframe */}
        {filePath && !error && (
          <iframe
            ref={frameRef}
            src={viewerSrc}
            className="reader-panel__frame"
            title={`Reader — ${fileLabel}`}
            sandbox="allow-scripts allow-same-origin"
            aria-label={`Document viewer: ${fileLabel}`}
            onLoad={() => {
              // The frame signals readiness via postMessage READY, not onLoad,
              // because pdf.js initialises asynchronously.
              setWebviewReady(false)
            }}
          />
        )}

        {/* Annotation popover */}
        {annotationPopoverOpen && selection && (
          <div
            className="reader-panel__popover-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.currentTarget === event.target) closeAnnotationPopover()
            }}
          >
            <div className="reader-panel__popover-anchor">
              <AnnotationPopover
                selection={selection}
                onAnnotate={handleAnnotate}
                onDismiss={closeAnnotationPopover}
              />
            </div>
          </div>
        )}
      </div>
    </UnifiedPanelShell>
  )
}

function messageFor(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}
