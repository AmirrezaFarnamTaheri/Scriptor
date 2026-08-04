import { lazy } from 'react'

export const CanvasPanel = lazy(() =>
  import('../CanvasPanel').then((module) => ({ default: module.CanvasPanel })),
)
export const GraphPanel = lazy(() =>
  import('../GraphPanel').then((module) => ({ default: module.GraphPanel })),
)
export const GitPanel = lazy(() =>
  import('../GitPanel').then((module) => ({ default: module.GitPanel })),
)
export const McpPanel = lazy(() =>
  import('../McpPanel').then((module) => ({ default: module.McpPanel })),
)
export const SettingsPanel = lazy(() =>
  import('../SettingsPanel').then((module) => ({ default: module.SettingsPanel })),
)
export const KnowledgeWorkbench = lazy(() =>
  import('../KnowledgeWorkbench').then((module) => ({ default: module.KnowledgeWorkbench })),
)
export const PublishCenter = lazy(() =>
  import('../PublishCenter').then((module) => ({ default: module.PublishCenter })),
)
export const VaultHealthDashboard = lazy(() =>
  import('../VaultHealthDashboard').then((module) => ({ default: module.VaultHealthDashboard })),
)
export const PortalPanel = lazy(() =>
  import('../portal/PortalPanel').then((module) => ({ default: module.PortalPanel })),
)
export const NoteHistoryPanel = lazy(() =>
  import('../NoteHistoryPanel').then((module) => ({ default: module.NoteHistoryPanel })),
)
export const QuickCapturePanel = lazy(() =>
  import('../portal/QuickCapturePanel').then((module) => ({ default: module.QuickCapturePanel })),
)
export const BibliographyPanel = lazy(() =>
  import('../BibliographyPanel').then((module) => ({ default: module.BibliographyPanel })),
)
export const SnippetsPanelLazy = lazy(() =>
  import('../SnippetsPanel').then((module) => ({ default: module.SnippetsPanel })),
)

export function PanelFallback() {
  return (
    <div className="panel-loading" role="status" aria-live="polite">
      Loading panel…
    </div>
  )
}
