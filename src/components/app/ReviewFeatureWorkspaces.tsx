import { lazy, Suspense } from 'react'
import type { ReviewFeature } from '../../hooks/useReviewFeatureWorkspaces'
import type { useVaultWorkspace } from '../../hooks/useVaultWorkspace'
import { ErrorBoundary } from '../ErrorBoundary'
import { PanelErrorFallback } from '../PanelErrorFallback'
import { PanelFallback } from './lazyPanels'
import '../../styles/components/collaboration.css'
import type { PluginRuntimePolicy, PluginWorkspaceDefinition, PluginWorkspaceRoute } from '@scriptor/plugin-api'
import { PluginWorkspaceHost } from '../plugins/PluginWorkspaceHost'
import { UnifiedPanelShell } from '../chrome/UnifiedPanelShell'
import { plantumlRender } from '../../bridge/commands/system'
const CollaborationPanel = lazy(() => import('../CollaborationPanel'))
const DiagramStudioPanel = lazy(() => import('../DiagramStudioPanel').then(module => ({ default: module.DiagramStudioPanel })))
const RuntimeConsolePanel = lazy(() => import('../plugins/RuntimeConsolePanel').then(module => ({ default: module.RuntimeConsolePanel })))
const SemanticInspectorPanel = lazy(() => import('../SemanticInspectorPanel').then(module => ({ default: module.SemanticInspectorPanel })))
const AssetDeckWorkspace = lazy(() => import('../AssetDeckWorkspace').then(module => ({ default: module.AssetDeckWorkspace })))
const PublishingStudioPanel = lazy(() => import('../PublishingStudioPanel').then(module => ({ default: module.PublishingStudioPanel })))
const DatabaseStudioPanel = lazy(() => import('../DatabaseStudioPanel').then(module => ({ default: module.DatabaseStudioPanel })))
const CaptureReviewerPanel = lazy(() => import('../CaptureReviewerPanel').then(module => ({ default: module.CaptureReviewerPanel })))

interface Props { active: ReviewFeature | null; workspace: ReturnType<typeof useVaultWorkspace>; onClose(): void; onOpenAsset(path: string): void;
  pluginWorkspace: PluginWorkspaceDefinition | null; pluginPolicy: PluginRuntimePolicy | null; onNavigate(route: PluginWorkspaceRoute): void | Promise<void>; onPluginCommand(pluginId: string, commandId: string): Promise<void> }
export function ReviewFeatureWorkspaces({ active, workspace, onClose, onOpenAsset, pluginWorkspace, pluginPolicy, onNavigate, onPluginCommand }: Props) {
  if (!active || !workspace.vault) return null
  const vaultId = workspace.vault.id
  const createNote = async (title: string, markdown: string) => {
    const path = await workspace.createNote(title, markdown, { requireMissing: true })
    if (!path) throw new Error('Note could not be created. Choose a unique title and try again.')
  }
  return <ErrorBoundary key={`${active}:${vaultId}`} name={`${active}-workspace`} fallback={<PanelErrorFallback title="Workspace" onDismiss={onClose} />}>
    <Suspense fallback={<PanelFallback />}>
      {active === 'collaboration' && <CollaborationPanel key={`${vaultId}:${workspace.activePath}`} path={workspace.activePath} vaultId={vaultId} googleConfig={workspace.vaultConfig.calendar_sync} onClose={onClose} onApplied={() => Promise.all([workspace.refreshVault(), workspace.refreshVaultConfig()]).then(() => undefined)} runSourceNoteMutation={workspace.runNoteMutation} />}
      {active === 'diagram' && <DiagramStudioPanel onClose={onClose} onSave={createNote} renderPlantUmlLocal={async source => (await plantumlRender(source)).svg} onOpenNote={path => void workspace.openNote(path)} />}
      {active === 'runtime' && <RuntimeConsolePanel vaultId={vaultId} onClose={onClose} />}
      {active === 'publishing' && <PublishingStudioPanel vaultId={vaultId} onClose={onClose} onOpenNote={path => void workspace.openNote(path)} runSourceNoteMutation={workspace.runNoteMutation} />}
      {active === 'database' && <DatabaseStudioPanel vaultOpen vaultId={vaultId} onClose={onClose} onOpenNote={path => void workspace.openNote(path)} runSourceNoteMutation={workspace.runNoteMutation} />}
      {active === 'capture' && <CaptureReviewerPanel vaultOpen vaultId={vaultId} onClose={onClose} onSaved={() => void workspace.refreshVault()} />}
      {active === 'semantic' && <SemanticInspectorPanel vaultId={vaultId} onClose={onClose} onOpenNote={path => void workspace.openNote(path)} />}
      {active === 'assets' && <AssetDeckWorkspace vaultId={vaultId} vaultRoot={workspace.vault.root_path} onClose={onClose} onOpenAsset={onOpenAsset} onOpenNote={path => void workspace.openNote(path)} onCreateNote={createNote} />}
      {active === 'plugin' && pluginWorkspace && <UnifiedPanelShell title={pluginWorkspace.title} ariaLabel={pluginWorkspace.title} helpTopic="plugins" onClose={onClose} wide>
        {pluginPolicy ? <PluginWorkspaceHost hideTitle definition={pluginWorkspace} policy={pluginPolicy} vaultId={vaultId} onNavigate={onNavigate} onCommand={commandId => onPluginCommand(pluginWorkspace.pluginId, commandId)} /> : <p role="alert">Plugin workspace is unavailable because its consent was removed.</p>}
      </UnifiedPanelShell>}
    </Suspense>
  </ErrorBoundary>
}
