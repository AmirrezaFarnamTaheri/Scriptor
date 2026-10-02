import { lazy, Suspense } from 'react'
import { ErrorBoundary } from '../ErrorBoundary'
import { PanelErrorFallback } from '../PanelErrorFallback'
import { PanelFallback } from './lazyPanels'
import type { LatexCompilerConfig } from '../../hooks/useLatexCompiler'

const SourceFileEditor = lazy(() => import('../SourceFileEditor').then(module => ({ default: module.SourceFileEditor })))
export function SourceFileWorkspace({ selection, onClose, onSaved, latexConfig }: {
  selection: { vaultId: string; path: string | null } | null
  onClose(): void
  onSaved(): Promise<void>
  latexConfig?: LatexCompilerConfig
}) {
  if (!selection) return null
  return <ErrorBoundary name="source-file-editor" fallback={<PanelErrorFallback title="Source editor" onDismiss={onClose} />}>
    <Suspense fallback={<PanelFallback />}>
      <SourceFileEditor key={selection.vaultId} expectedVaultId={selection.vaultId} path={selection.path} onClose={onClose} onSaved={onSaved} latexConfig={latexConfig} />
    </Suspense>
  </ErrorBoundary>
}
