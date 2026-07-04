import { useMemo, type CSSProperties } from 'react'
import { MarkdownPreview, type DqlResultRow, type CodeChunkRunResult } from '@scriptor/renderer'

import { WidgetCard } from './chrome/WorkspaceChrome'

interface ExportPrintPreviewProps {
  markdown: string
  activePath: string | null
  previewProps: {
    fetchNote?: (target: string) => Promise<string | null>
    readVaultText?: (path: string) => Promise<string | null>
    executeDql?: (query: string) => Promise<DqlResultRow[]>
    runCodeChunk?: (language: string, code: string) => Promise<CodeChunkRunResult>
    postProcessHtml?: (html: string) => string
    renderPlantUmlLocal?: (source: string) => Promise<string | null>
  }
}

const PAGE_HEIGHT_PX = 960

export function ExportPrintPreview({ markdown, activePath, previewProps }: ExportPrintPreviewProps) {
  const pageCount = useMemo(() => {
    const lines = markdown.split('\n').length
    const headings = (markdown.match(/^#{1,2}\s/gm) ?? []).length
    const estimate = Math.ceil((lines * 18 + headings * 40) / PAGE_HEIGHT_PX)
    return Math.max(1, estimate)
  }, [markdown])

  return (
    <WidgetCard title="Print layout preview">
      <p className="health-subtitle">
        Simulated A4 pages with CSS page breaks — Pandoc may paginate differently in the final PDF.
      </p>
      <div className="print-preview-meta">
        <span>{pageCount} page{pageCount === 1 ? '' : 's'} estimated</span>
      </div>
      <div className="print-preview-pages" style={{ '--print-page-height': `${PAGE_HEIGHT_PX}px` } as CSSProperties}>
        {Array.from({ length: pageCount }, (_, index) => (
          <article key={index} className="print-preview-page" aria-label={`Page ${index + 1}`}>
            <header className="print-preview-page-header">Page {index + 1}</header>
            {index === 0 && activePath ? (
              <div className="print-preview-body markdown-preview">
                <MarkdownPreview
                  markdown={markdown}
                  className="markdown-preview print-preview-markdown"
                  basePath={activePath}
                  fetchNote={previewProps.fetchNote}
                  readVaultText={previewProps.readVaultText}
                  executeDql={previewProps.executeDql}
                  runCodeChunk={previewProps.runCodeChunk}
                  postProcessHtml={previewProps.postProcessHtml}
                  renderPlantUmlLocal={previewProps.renderPlantUmlLocal}
                />
              </div>
            ) : index > 0 ? (
              <p className="print-preview-continued">(continued…)</p>
            ) : null}
          </article>
        ))}
      </div>
    </WidgetCard>
  )
}
