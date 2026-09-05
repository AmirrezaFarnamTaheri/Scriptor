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

import '../../styles/components/reader-panel.css'

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
  getReaderViewerLocation,
  loadReaderAnnotations,
  saveReaderAnnotations,
  type ReaderAnnotationRecord,
} from '../../bridge/reader'
import { createReaderAnnotationSaveQueue } from './createAnnotationSaveQueue'
import {
  parseReaderInboundMessage,
  readerUrl,
  type ReaderOutboundMessage,
  type ReaderViewerLocation,
} from './readerProtocol'

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
  // Wrapper state is keyed by the document type it was resolved for: the active
  // location/ready flags are derived from that key instead of being reset from an
  // effect, so switching documents can never render the previous viewer for a frame.
  const [viewer, setViewer] = useState<{
    fileType: string
    location: ReaderViewerLocation | null
    ready: boolean
  } | null>(null)
  const [hasUnsavedAnnotations, setHasUnsavedAnnotations] = useState(false)
  const [closeWarning, setCloseWarning] = useState(false)
  const [annotationError, setAnnotationError] = useState<string | null>(null)
  const [annotationsLoadedKey, setAnnotationsLoadedKey] = useState<string | null>(null)
  const [fileReloadGeneration, setFileReloadGeneration] = useState(0)
  const readyTimerRef = useRef<number | null>(null)

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
        onError: (cause) => setAnnotationError(`Could not save annotation: ${messageFor(cause)}`),
        onPendingChange: (pending) => {
          setHasUnsavedAnnotations(pending)
          if (!pending) setCloseWarning(false)
        },
      }),
    [onAnnotationCreate],
  )

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!annotationSaveQueue.hasPending()) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [annotationSaveQueue])

  useEffect(
    () => () => {
      // React can unmount the Reader for reasons other than its explicit Close
      // button (vault switches, workspace replacement, app teardown). Keep the
      // queue alive long enough to drain/retry its final snapshot rather than
      // dropping the only in-memory copy of a just-created annotation. Window
      // teardown is additionally guarded by the beforeunload prompt above.
      void annotationSaveQueue.flush()
    },
    [annotationSaveQueue],
  )

  useEffect(() => () => {
    if (readyTimerRef.current !== null) window.clearTimeout(readyTimerRef.current)
  }, [])

  const handleClose = useCallback(() => {
    void (async () => {
      if (annotationSaveQueue.hasPending()) {
        setCloseWarning(true)
        const flushed = await annotationSaveQueue.flush()
        if (!flushed) return
      }
      annotationSaveQueue.reset()
      onClose()
    })()
  }, [annotationSaveQueue, onClose])

  const retryAnnotationSave = useCallback(() => {
    if (annotationSaveQueue.retry()) setAnnotationError(null)
  }, [annotationSaveQueue])

  // ── File I/O ───────────────────────────────────────────────────────────────
  const fileState = useReaderFile(filePath, vaultRoot, fileReloadGeneration)
  const viewerLocation = viewer?.fileType === fileType ? viewer.location : null
  const webviewReady = viewer?.fileType === fileType && viewer.ready

  useEffect(() => {
    if (!filePath || !vaultRoot) return
    let cancelled = false
    void loadReaderAnnotations(filePath)
      .then((saved) => {
        if (!cancelled) {
          setAnnotationError(null)
          setAnnotations(saved as ReaderAnnotation[])
          setAnnotationsLoadedKey(`${vaultRoot}\0${filePath}`)
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) setAnnotationError(`Could not load annotations: ${messageFor(cause)}`)
      })
    return () => { cancelled = true }
  }, [filePath, vaultRoot, setAnnotations])

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

  useEffect(() => {
    if (fileType !== 'pdf' && fileType !== 'epub') return
    let cancelled = false
    void getReaderViewerLocation(fileType)
      .then((location) => {
        if (!cancelled) setViewer({ fileType, location, ready: false })
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(`Reader wrapper is unavailable: ${messageFor(cause)}`)
      })
    return () => {
      cancelled = true
    }
  }, [fileType, setError])

  // Forward bytes to the webview once both the frame and bytes are ready.
  useEffect(() => {
    if (!webviewReady || fileState.status !== 'ready' || !frameRef.current?.contentWindow) return
    if (!viewerLocation) return
    const bytes = fileState.bytes
    const buffer = bytes.buffer as ArrayBuffer
    if (buffer.byteLength === 0) return
    frameRef.current.contentWindow.postMessage(
      { type: 'LOAD_BYTES', bytes: buffer },
      viewerLocation.origin,
      [buffer],
    )
  }, [webviewReady, fileState, viewerLocation])

  useEffect(() => {
    if (fileState.status === 'error') setError(fileState.message)
  }, [fileState, setError])

  // ── Postmessage listener ───────────────────────────────────────────────────
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.source !== frameRef.current?.contentWindow) return
      if (!viewerLocation || e.origin !== viewerLocation.origin) return
      const msg = parseReaderInboundMessage(e.data)
      if (!msg) return
      switch (msg.type) {
        case 'READY':
          if (readyTimerRef.current !== null) {
            window.clearTimeout(readyTimerRef.current)
            readyTimerRef.current = null
          }
          setViewer((current) => (current ? { ...current, ready: true } : current))
          break
        case 'LOADED':
          setLoading(false)
          break
        case 'POSITION':
          setPosition(msg.position)
          break
        case 'SELECTION':
          setSelection({ anchor: msg.anchor, quote: msg.quote })
          openAnnotationPopover()
          break
        case 'SELECTION_CLEAR':
          setSelection(null)
          break
        case 'ERROR':
          setError(msg.message)
          break
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [viewerLocation, setPosition, setSelection, setError, setLoading, openAnnotationPopover])

  // Re-highlight existing annotations only once both independent async inputs
  // are ready. If the iframe posts READY before native annotation loading
  // finishes, the annotation state change below replays the persisted set.
  useEffect(() => {
    if (!webviewReady || !frameRef.current?.contentWindow || !viewerLocation) return
    if (!filePath || !vaultRoot || annotationsLoadedKey !== `${vaultRoot}\0${filePath}`) return
    frameRef.current.contentWindow.postMessage(
      { type: 'HIGHLIGHTS', annotations },
      viewerLocation.origin,
    )
  }, [annotations, annotationsLoadedKey, webviewReady, filePath, vaultRoot, viewerLocation])

  // ── Navigation helpers ────────────────────────────────────────────────────
  const sendMsg = useCallback((msg: ReaderOutboundMessage) => {
    if (!viewerLocation) return
    frameRef.current?.contentWindow?.postMessage(msg, viewerLocation.origin)
  }, [viewerLocation])

  const handlePrev = useCallback(() => sendMsg({ type: 'GOTO', position: 'prev' }), [sendMsg])
  const handleNext = useCallback(() => sendMsg({ type: 'GOTO', position: 'next' }), [sendMsg])
  const handleZoomIn = useCallback(() => sendMsg({ type: 'ZOOM', delta: +0.25 }), [sendMsg])
  const handleZoomOut = useCallback(() => sendMsg({ type: 'ZOOM', delta: -0.25 }), [sendMsg])

  // ── Annotation creation ───────────────────────────────────────────────────
  const handleAnnotate = useCallback(
    (partial: Omit<ReaderAnnotation, 'id' | 'createdAt'>) => {
      if (!filePath) {
        setAnnotationError('Could not save annotation: no reader document is open.')
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
    [addAnnotation, annotationSaveQueue, filePath, sendMsg],
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
  const viewerSrc = viewerLocation ? readerUrl(viewerLocation, window.location.origin) : null
  const fileLabel = filePath ? filePath.split('/').pop() ?? filePath : 'No file open'

  return (
    <UnifiedPanelShell
      title="Reader"
      subtitle={fileLabel}
      icon={<BookOpen size={18} />}
      ariaLabel="Document reader"
      onClose={handleClose}
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
        {closeWarning && (
          <p className="reader-panel__save-warning" role="status">
            Annotations are still saving. Retry a failed save or wait before closing the reader.
          </p>
        )}
        {annotationError && (
          <div className="reader-panel__annotation-error" role="alert">
            <p>{annotationError}</p>
            {hasUnsavedAnnotations && (
              <button type="button" onClick={retryAnnotationSave}>Retry annotation save</button>
            )}
          </div>
        )}
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
        {filePath && viewerSrc && !error && (
          <iframe
            ref={frameRef}
            src={viewerSrc}
            className="reader-panel__frame"
            title={`Reader — ${fileLabel}`}
            sandbox="allow-scripts allow-same-origin"
            aria-label={`Document viewer: ${fileLabel}`}
            onLoad={() => {
              // The first transfer deliberately detaches the parent ArrayBuffer to avoid
              // duplicating large documents. If the iframe reloads afterwards, re-read the
              // same bounded native file instead of attempting to resend a detached buffer.
              if (fileState.status === 'ready' && fileState.bytes.buffer.byteLength === 0) {
                setFileReloadGeneration((generation) => generation + 1)
              }
              // The frame signals readiness via postMessage READY, not onLoad,
              // because pdf.js initialises asynchronously.
              setViewer((current) => (current ? { ...current, ready: false } : current))
              if (readyTimerRef.current !== null) window.clearTimeout(readyTimerRef.current)
              readyTimerRef.current = window.setTimeout(() => {
                setError('Reader wrapper did not become ready. Close and reopen the document.')
              }, 8_000)
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
