import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'

import 'katex/dist/katex.min.css'
import 'highlight.js/styles/github.min.css'

import { renderMermaidDiagrams } from './mermaid-client.ts'
import { renderPlantUmlDiagrams } from './plantuml-client.ts'
import { attachPreviewCodeCopy } from './code-copy.ts'
import { hydrateDqlBlocks, type DqlResultRow } from './dql-client.ts'
import { hydrateMpeCodeChunks } from './mpe-client.ts'
import { attachMediumZoom } from './medium-zoom.ts'
import { hydrateWikilinkEmbeds } from './embed-client.ts'
import { injectPreviewUserCss, loadVaultPreviewCss } from './preview-user-css.ts'
import { preprocessImportsAsync } from './remark-import.ts'
import { renderMarkdownPipeline, type PreviewPipelineOptions } from './pipeline.ts'
import { renderMarkdownPreview } from './preview.ts'
import PreviewWorker from './preview.worker.ts?worker'
import {
  applyPreviewPostProcess,
  combinePreviewWarnings,
  previewEnhancementWarning,
} from './preview-result.ts'

export interface MarkdownPreviewHandle {
  getContentRoot(): HTMLElement | null
}

export interface MarkdownPreviewProps {
  markdown: string
  className?: string
  basePath?: string | null
  fetchNote?: (path: string) => Promise<string | null>
  enableBreaks?: boolean
  executeDql?: (query: string) => Promise<DqlResultRow[]>
  runCodeChunk?: (language: string, code: string) => Promise<{ exit_code: number; stdout: string; stderr: string; duration_ms: number; language: string }>
  postProcessHtml?: (html: string) => string
  readVaultText?: (path: string) => Promise<string | null>
  renderPlantUmlLocal?: (source: string) => Promise<string | null>
}

interface WorkerRenderRequest {
  id: number
  markdown: string
  options: PreviewPipelineOptions
}

const PREVIEW_DEBOUNCE_MS = 200
const PREVIEW_WORKER_TIMEOUT_MS = 5_000
const PREVIEW_WORKER_PROVISIONAL_MS = 900
const USE_PREVIEW_WORKER = import.meta.env.VITE_SCREENSHOT_MODE !== 'true'

/**
 * Sticky kill-switch: some embedded environments (Tauri custom protocol) never
 * deliver module-worker messages. After the first timeout we stop creating
 * workers so later renders take the fast main-thread path instead of paying
 * the full timeout again on every keystroke.
 */
let previewWorkerDisabled = false

function renderFailureMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message
  if (typeof error === 'string' && error.trim()) return error.trim()
  return fallback
}

export const MarkdownPreview = forwardRef<MarkdownPreviewHandle, MarkdownPreviewProps>(
  function MarkdownPreview(
    {
      markdown,
      className,
      basePath,
      fetchNote,
      enableBreaks,
      executeDql,
      runCodeChunk,
      postProcessHtml,
      readVaultText,
      renderPlantUmlLocal,
    },
    ref,
  ) {
    const [html, setHtml] = useState('')
    const [isRendering, setIsRendering] = useState(false)
    const [renderError, setRenderError] = useState<string | null>(null)
    const [renderWarning, setRenderWarning] = useState<string | null>(null)
    const requestId = useRef(0)
    const workerRef = useRef<Worker | null>(null)
    const workerFactoryRef = useRef<(() => Worker | null) | null>(null)
    const workerFallbackRef = useRef<WorkerRenderRequest | null>(null)
    const workerDeadlineRef = useRef<number | null>(null)
    const workerProvisionalRef = useRef<number | null>(null)
    const debounceTimer = useRef<number | null>(null)
    const contentRef = useRef<HTMLDivElement>(null)
    const postProcessRef = useRef(postProcessHtml)
    postProcessRef.current = postProcessHtml
    const postProcessWarningRef = useRef<string | null>(null)
    const fetchNoteRef = useRef(fetchNote)
    fetchNoteRef.current = fetchNote
    const readVaultTextRef = useRef(readVaultText)
    readVaultTextRef.current = readVaultText
    const renderPlantUmlLocalRef = useRef(renderPlantUmlLocal)
    renderPlantUmlLocalRef.current = renderPlantUmlLocal
    const basePathRef = useRef(basePath)
    basePathRef.current = basePath
    const enableBreaksRef = useRef(enableBreaks)
    enableBreaksRef.current = enableBreaks

    useImperativeHandle(ref, () => ({
      getContentRoot: () => contentRef.current,
    }))

    const clearWorkerProvisional = useCallback(() => {
      if (workerProvisionalRef.current === null) return
      window.clearTimeout(workerProvisionalRef.current)
      workerProvisionalRef.current = null
    }, [])
    
    const clearWorkerDeadline = useCallback(() => {
      if (workerDeadlineRef.current === null) return
      window.clearTimeout(workerDeadlineRef.current)
      workerDeadlineRef.current = null
    }, [])

    const commitRenderedHtml = useCallback(
      (nextHtml: string, fallbackWarning?: string | null) => {
        clearWorkerProvisional()
        workerFallbackRef.current = null
        const result = applyPreviewPostProcess(nextHtml, postProcessRef.current)
        const combined =
          [fallbackWarning, result.warning].filter(Boolean).join('; ') || null
        postProcessWarningRef.current = combined
        setRenderError(null)
        setRenderWarning(combined)
        setHtml(result.html)
        setIsRendering(false)
      },
      [clearWorkerProvisional],
    )

    const commitRenderFailure = useCallback((error: unknown, fallback: string) => {
      clearWorkerProvisional()
      workerFallbackRef.current = null
      postProcessWarningRef.current = null
      setRenderWarning(null)
      setRenderError(renderFailureMessage(error, fallback))
      setHtml('')
      setIsRendering(false)
    }, [clearWorkerProvisional])

    useEffect(() => {
      if (!USE_PREVIEW_WORKER || previewWorkerDisabled) return undefined

      const renderFallback = () => {
        const fallback = workerFallbackRef.current
        if (!fallback || fallback.id !== requestId.current) return
        try {
          const fallbackHtml = renderMarkdownPreview(fallback.markdown, fallback.options)
          if (requestId.current !== fallback.id) return
          commitRenderedHtml(
            fallbackHtml,
            'Showing core Markdown preview (worker error)',
          )
        } catch (error) {
          if (requestId.current !== fallback.id) return
          commitRenderFailure(error, 'Preview worker and fallback rendering failed')
        }
      }

      const createWorker = (): Worker | null => {
        let worker: Worker
        try {
          // Classic bundled worker (vite worker.format=iife): module workers
          // never deliver messages under the Tauri custom protocol.
          worker = new PreviewWorker()
        } catch {
          previewWorkerDisabled = true
          workerRef.current = null
          return null
        }

        worker.onmessage = (
          event: MessageEvent<{ id: number; html?: string; error?: string }>,
        ) => {
          clearWorkerDeadline()
          const fallback = workerFallbackRef.current
          if (event.data.id !== requestId.current || fallback?.id !== event.data.id) return
          if (event.data.error) {
            commitRenderFailure(event.data.error, 'Preview rendering failed')
            return
          }
          commitRenderedHtml(event.data.html ?? '')
        }

        worker.onerror = (event) => {
          event.preventDefault()
          renderFallback()
        }
        worker.onmessageerror = renderFallback
        workerRef.current = worker
        return worker
      }

      workerFactoryRef.current = createWorker
      createWorker()

      return () => {
        clearWorkerProvisional()
        clearWorkerDeadline()
        workerFallbackRef.current = null
        workerFactoryRef.current = null
        workerRef.current?.terminate()
        workerRef.current = null
      }
    }, [clearWorkerDeadline, clearWorkerProvisional, commitRenderFailure, commitRenderedHtml])

    useEffect(() => {
      if (debounceTimer.current) {
        window.clearTimeout(debounceTimer.current)
      }

      clearWorkerProvisional()
      clearWorkerDeadline()
      requestId.current += 1
      const currentId = requestId.current
      workerFallbackRef.current = null
      setIsRendering(true)
      setRenderError(null)
      debounceTimer.current = window.setTimeout(() => {
        void (async () => {
          let prepared = markdown
          const noteFetcher = fetchNoteRef.current
          const noteBasePath = basePathRef.current
          if (noteFetcher && noteBasePath) {
            try {
              prepared = await preprocessImportsAsync(prepared, {
                fetchNote: noteFetcher,
                basePath: noteBasePath,
              })
            } catch {
              prepared = markdown
            }
          }
          if (requestId.current !== currentId) return
          const options: PreviewPipelineOptions = {}
          if (enableBreaksRef.current) options.enableBreaks = true

          const renderOnMainThread = (fallbackWarning?: string | null) => {
            try {
              const nextHtml = renderMarkdownPreview(prepared, options)
              if (requestId.current !== currentId) return
              commitRenderedHtml(nextHtml, fallbackWarning)
            } catch (error) {
              if (requestId.current !== currentId) return
              commitRenderFailure(error, 'Preview rendering failed')
            }
          }

          if (!USE_PREVIEW_WORKER) {
            renderOnMainThread()
            return
          }

          const worker = workerRef.current
          if (!worker) {
            renderOnMainThread()
            return
          }
          const workerRequest = { id: currentId, markdown: prepared, options }
          workerFallbackRef.current = workerRequest
          const showProvisional = window.setTimeout(() => {
            if (requestId.current !== currentId || workerFallbackRef.current?.id !== currentId) return
            renderOnMainThread('Showing core Markdown preview (worker starting)')
          }, PREVIEW_WORKER_PROVISIONAL_MS)
          window.setTimeout(() => window.clearTimeout(showProvisional), PREVIEW_WORKER_TIMEOUT_MS + 100)
          try {
            worker.postMessage(workerRequest)
            workerDeadlineRef.current = window.setTimeout(() => {
              if (
                requestId.current !== currentId ||
                workerFallbackRef.current?.id !== currentId
              ) {
                return
              }
              workerFallbackRef.current = null
              if (workerRef.current === worker) {
                worker.terminate()
                workerRef.current = null
                workerFactoryRef.current?.()
              }
              clearWorkerProvisional()
              previewWorkerDisabled = true
              renderOnMainThread(null)
            }, PREVIEW_WORKER_TIMEOUT_MS)
          } catch {
            renderOnMainThread('Showing core Markdown preview (worker unavailable)')
          }
        })()
      }, PREVIEW_DEBOUNCE_MS)

      return () => {
        if (debounceTimer.current) {
          window.clearTimeout(debounceTimer.current)
          debounceTimer.current = null
        }
        clearWorkerDeadline()
      }
    }, [
      markdown,
      basePath,
      enableBreaks,
      fetchNote,
      postProcessHtml,
      clearWorkerDeadline,
      clearWorkerProvisional,
      commitRenderFailure,
      commitRenderedHtml,
    ])

    useEffect(() => {
      const root = contentRef.current
      if (!html || !root) return undefined
      let cancelled = false
      let detachZoom: (() => void) | undefined
      let detachCopy: (() => void) | undefined

      const runEnhancement = async (
        phase: string,
        action: () => void | Promise<void>,
        warnings: string[],
      ) => {
        if (cancelled) return
        try {
          await action()
        } catch (error) {
          warnings.push(previewEnhancementWarning(phase, error))
        }
      }

      void (async () => {
        const warnings: string[] = []
        const noteFetcher = fetchNoteRef.current

        await runEnhancement('Mermaid rendering', () => renderMermaidDiagrams(root), warnings)
        await runEnhancement(
          'PlantUML rendering',
          () =>
            renderPlantUmlDiagrams(root, (source) =>
              renderPlantUmlLocalRef.current?.(source) ?? Promise.resolve(null),
            ),
          warnings,
        )
        if (noteFetcher) {
          await runEnhancement(
            'Embedded-note rendering',
            () =>
              hydrateWikilinkEmbeds(root, {
                fetchNote: noteFetcher,
                renderMarkdown: (body) =>
                  renderMarkdownPipeline(body, { enableBreaks: enableBreaksRef.current }),
              }),
            warnings,
          )
        }
        if (executeDql) {
          await runEnhancement('DQL hydration', () => hydrateDqlBlocks(root, executeDql), warnings)
        }
        await runEnhancement(
          'Preview stylesheet loading',
          async () => {
            const css = await loadVaultPreviewCss(
              (path) => readVaultTextRef.current?.(path) ?? Promise.resolve(null),
            )
            if (!cancelled && css) injectPreviewUserCss(root, css)
          },
          warnings,
        )
        if (runCodeChunk) {
          await runEnhancement(
            'Code-chunk hydration',
            () => hydrateMpeCodeChunks(root, runCodeChunk),
            warnings,
          )
        }
        await runEnhancement(
          'Preview image zoom',
          () => {
            detachZoom = attachMediumZoom(root)
          },
          warnings,
        )
        await runEnhancement(
          'Preview code-copy controls',
          () => {
            detachCopy = attachPreviewCodeCopy(root)
          },
          warnings,
        )

        if (!cancelled) {
          setRenderWarning(combinePreviewWarnings(postProcessWarningRef.current, ...warnings))
        }
      })()

      return () => {
        cancelled = true
        detachZoom?.()
        detachCopy?.()
      }
    }, [
      html,
      executeDql,
      fetchNote,
      readVaultText,
      renderPlantUmlLocal,
      runCodeChunk,
    ])

    return (
      <article
        className={className}
        aria-label="Markdown preview"
        aria-busy={isRendering}
        data-preview-degraded={renderWarning ? 'true' : 'false'}
      >
        {renderError ? (
          <p className="preview-error" role="alert">
            {renderError}
          </p>
        ) : (
          <>
            {renderWarning ? (
              <p className="preview-warning" role="status" aria-live="polite">
                {renderWarning}
              </p>
            ) : null}
            {isRendering && !html ? (
              <p className="preview-loading" role="status">
                Rendering preview...
              </p>
            ) : (
              <div ref={contentRef} dangerouslySetInnerHTML={{ __html: html }} />
            )}
          </>
        )}
      </article>
    )
  },
)
