import { MarkdownPreview } from '@scriptor/renderer'
import { formatPandocCommand, supportsHtmlSnippetPreview } from '@scriptor/export'

import { WidgetCard } from './chrome/WorkspaceChrome'
import type { ExportJobOutput } from '../types/vault'

interface ExportPreflightPreviewProps {
  result: ExportJobOutput
  profileLabel: string
  activePath: string | null
  draftMarkdown: string
  previewProps: {
    fetchNote?: (target: string) => Promise<string | null>
    readVaultText?: (path: string) => Promise<string | null>
    executeDql?: (query: string) => Promise<unknown>
    runCodeChunk?: (language: string, code: string) => Promise<unknown>
    postProcessHtml?: (html: string) => string
    renderPlantUmlLocal?: (source: string) => Promise<string | null>
  }
}

export function ExportPreflightPreview({
  result,
  profileLabel,
  activePath,
  draftMarkdown,
  previewProps,
}: ExportPreflightPreviewProps) {
  const commandLine = formatPandocCommand(result.command)
  const showHtmlPreview = supportsHtmlSnippetPreview(result.format)

  return (
    <section className="publish-center-section publish-preflight" aria-live="polite">
      <h3>Preflight preview</h3>
      <p className="health-subtitle">Dry run complete — no artifact was written to disk.</p>

      <dl className="publish-preflight-meta">
        <div>
          <dt>Profile</dt>
          <dd>{profileLabel}</dd>
        </div>
        <div>
          <dt>Format</dt>
          <dd>{result.format.toUpperCase()}</dd>
        </div>
        <div>
          <dt>Planned output</dt>
          <dd>
            <code className="publish-artifact">{result.artifact_path}</code>
          </dd>
        </div>
      </dl>

      <WidgetCard title="Pandoc command">
        <pre className="publish-command-preview">{commandLine}</pre>
      </WidgetCard>

      {showHtmlPreview && activePath ? (
        <WidgetCard title="HTML snippet preview">
          <p className="health-subtitle">
            In-app render of the note body; Pandoc may apply extra filters and styling.
          </p>
          <div className="publish-html-snippet markdown-preview">
            <MarkdownPreview
              markdown={draftMarkdown}
              className="markdown-preview"
              basePath={activePath}
              fetchNote={previewProps.fetchNote}
              readVaultText={previewProps.readVaultText}
              executeDql={previewProps.executeDql as any}
              runCodeChunk={previewProps.runCodeChunk as any}
              postProcessHtml={previewProps.postProcessHtml}
              renderPlantUmlLocal={previewProps.renderPlantUmlLocal}
            />
          </div>
        </WidgetCard>
      ) : (
        <p className="health-subtitle">
          HTML snippet preview is available for HTML export profiles. Command and output path above are still valid.
        </p>
      )}
    </section>
  )
}
