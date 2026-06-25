import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

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

const PREVIEW_DEBOUNCE_MS = 200
const USE_PREVIEW_WORKER = import.meta.env.VITE_SCREENSHOT_MODE !== 'true'

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
    const requestId = useRef(0)
    const workerRef = useRef<Worker | null>(null)
    const debounceTimer = useRef<number | null>(null)
    const contentRef = useRef<HTMLDivElement>(null)
    const postProcessRef = useRef(postProcessHtml)
    postProcessRef.current = postProcessHtml
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

    useEffect(() => {
      if (!USE_PREVIEW_WORKER) return

      const worker = new Worker(new URL('./preview.worker.ts', import.meta.url), {
        type: 'module',
      })
      workerRef.current = worker

      worker.onmessage = (
        event: MessageEvent<{ id: number; html?: string; error?: string }>,
      ) => {
        if (event.data.id !== requestId.current) return
        if (event.data.error) {
          setRenderError(event.data.error)
          setHtml('')
        } else {
          setRenderError(null)
          const nextHtml = event.data.html ?? ''
          setHtml(postProcessRef.current ? postProcessRef.current(nextHtml) : nextHtml)
        }
        setIsRendering(false)
      }

      worker.onerror = () => {
        const currentId = requestId.current
        try {
          const html = renderMarkdownPreview(markdown, {
            enableBreaks: enableBreaksRef.current,
          })
          if (requestId.current !== currentId) return
          setRenderError(null)
          setHtml(postProcessRef.current ? postProcessRef.current(html) : html)
        } catch {
          setRenderError('Preview worker failed')
          setHtml('')
        }
        setIsRendering(false)
      }

      return () => {
        worker.terminate()
        workerRef.current = null
      }
    }, [])

    useEffect(() => {
      if (debounceTimer.current) {
        window.clearTimeout(debounceTimer.current)
      }

      setIsRendering(true)
      debounceTimer.current = window.setTimeout(() => {
        void (async () => {
          requestId.current += 1
          const currentId = requestId.current
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

          if (!USE_PREVIEW_WORKER) {
            try {
              const html = renderMarkdownPreview(prepared, options)
              if (requestId.current !== currentId) return
              setRenderError(null)
              setHtml(postProcessRef.current ? postProcessRef.current(html) : html)
            } catch (error) {
              if (requestId.current !== currentId) return
              setRenderError(error instanceof Error ? error.message : 'Preview rendering failed')
              setHtml('')
            }
            setIsRendering(false)
            return
          }

          const worker = workerRef.current
          if (!worker) return
          worker.postMessage({ id: currentId, markdown: prepared, options })
        })()
      }, PREVIEW_DEBOUNCE_MS)

      return () => {
        if (debounceTimer.current) {
          window.clearTimeout(debounceTimer.current)
        }
      }
    }, [markdown, basePath, fetchNote, enableBreaks])

    useEffect(() => {
      if (!html || !contentRef.current) return
      let cancelled = false
      let detachZoom: (() => void) | undefined
      let detachCopy: (() => void) | undefined
      const noteFetcher = fetchNoteRef.current
      void renderMermaidDiagrams(contentRef.current)
        .then(() =>
          renderPlantUmlDiagrams(contentRef.current!, (source) =>
            renderPlantUmlLocalRef.current?.(source) ?? Promise.resolve(null),
          ),
        )
        .then(() =>
          noteFetcher && contentRef.current
            ? hydrateWikilinkEmbeds(contentRef.current, {
                fetchNote: noteFetcher,
                renderMarkdown: (body) => renderMarkdownPipeline(body, { enableBreaks: enableBreaksRef.current }),
              })
            : undefined,
        )
        .then(() => (executeDql ? hydrateDqlBlocks(contentRef.current!, executeDql) : undefined))
        .then(() =>
          loadVaultPreviewCss((path) => readVaultTextRef.current?.(path) ?? Promise.resolve(null)),
        )
        .then((css) => {
          if (!cancelled && contentRef.current && css) {
            injectPreviewUserCss(contentRef.current, css)
          }
        })
        .then(() =>
          runCodeChunk && contentRef.current
            ? hydrateMpeCodeChunks(contentRef.current, runCodeChunk)
            : undefined,
        )
        .then(() => {
          if (!cancelled && contentRef.current) {
            detachZoom = attachMediumZoom(contentRef.current)
            detachCopy = attachPreviewCodeCopy(contentRef.current)
          }
        })
        .catch(() => {
          if (!cancelled) {
            setRenderError('Mermaid diagram rendering failed')
          }
        })
      return () => {
        cancelled = true
        detachZoom?.()
        detachCopy?.()
      }
    }, [html, executeDql, runCodeChunk, fetchNote])

    return (
      <article className={className} aria-label="Markdown preview" aria-busy={isRendering}>
        {renderError ? (
          <p className="preview-error" role="alert">
            {renderError}
          </p>
        ) : isRendering && !html ? (
          <p className="preview-loading" role="status">
            Rendering preview...
          </p>
        ) : (
          <div ref={contentRef} dangerouslySetInnerHTML={{ __html: html }} />
        )}
      </article>
    )
  },
)
