import { useId, type ReactNode } from 'react'
import type { PluginWorkspaceRoute } from '@scriptor/plugin-api'
import type { useWorkspaceComposition } from '../../hooks/useWorkspaceComposition'
import type { useVaultWorkspace } from '../../hooks/useVaultWorkspace'
import type { usePluginRegistry } from '../../hooks/usePluginRegistry'
import { WorkspaceLeafTabs } from './WorkspaceLeafTabs'
import { WorkspaceShortcutBar } from './WorkspaceShortcutBar'
import { ReviewFeatureWorkspaces } from '../app/ReviewFeatureWorkspaces'
import { SourceFileWorkspace } from '../app/SourceFileWorkspace'
import { WorkspaceEmbeddedPanel } from '../../context/WorkspacePanelContext'
import { WorkspaceLeafLifecycleProvider } from '../../context/WorkspaceLeafLifecycle'
import { WorkspaceNotePreview } from './WorkspaceNotePreview'
import type { ReviewFeature } from '../../hooks/useReviewFeatureWorkspaces'
import { useI18n } from '../../lib/i18n'
import { workspaceCopy, workspaceTransitionCopy } from '../../lib/workspaceCopy'
import './workspace-leaf-dock.css'

const featureIds: Record<string, ReviewFeature> = { 'open-drive-collaboration': 'collaboration', 'open-diagram-studio': 'diagram', 'open-runtime-console': 'runtime', 'open-semantic-inspector': 'semantic', 'open-asset-deck': 'assets', 'open-publishing-studio': 'publishing', 'open-database-studio': 'database', 'open-capture-reviewer': 'capture' }
interface Props {
  composition: ReturnType<typeof useWorkspaceComposition>
  workspace: ReturnType<typeof useVaultWorkspace>
  plugins: ReturnType<typeof usePluginRegistry>
  children: ReactNode
  onOpenAsset(path: string): void
  onNavigate(route: PluginWorkspaceRoute): void | Promise<void>
  onPluginCommand(pluginId: string, commandId: string): Promise<void>
}
export function WorkspaceLeafDock({ composition: dock, workspace, plugins, children, onOpenAsset, onNavigate, onPluginCommand }: Props) {
  const id = useId()
  const { locale } = useI18n()
  const copy = workspaceCopy(locale)
  const primary = dock.leafForGroup('primary')
  const secondary = dock.leafForGroup('secondary')
  const revealed = dock.state.leaves.find(leaf => leaf.id === dock.revealed)
  const visible = (leafId: string, group: 'primary' | 'secondary') => (revealed?.group === group ? revealed.id : group === 'primary' ? primary?.id : secondary?.id) === leafId
  const writing = !primary || (primary.reference.kind === 'note' && dock.visited.has(primary.id)) || (primary.reference.kind === 'feature' && primary.reference.id === 'editor')
  const vaultId = workspace.vault?.id
  const focusedGroup = revealed?.group ?? dock.activeLeaf?.group ?? 'primary'
  return <section className={`editor-panel workspace-leaf-dock${secondary ? ' has-side' : ''} focus-${focusedGroup}`} aria-label={copy.navigation}>
    {vaultId && <WorkspaceShortcutBar locale={locale} preferences={dock.shortcuts.preferences} open={dock.shortcuts.open}
      onOpen={dock.shortcuts.show} onClose={dock.shortcuts.close} onSave={dock.shortcuts.save}
      catalog={[
        { id: 'writing', label: copy.writing, run: () => { void dock.open({ kind: 'feature', id: 'editor' }, 'primary') } },
        { id: 'source', label: copy.source, run: () => dock.openSource(null) },
        { id: 'preview', label: copy.preview, disabled: !workspace.activePath, run: () => { if (workspace.activePath) void dock.open({ kind: 'note', path: workspace.activePath }, 'secondary') } },
        ...dock.commands.map(command => ({ id: command.id, label: command.label, run: () => { void command.run() } })),
      ]} />}
    {dock.status !== 'idle' && <p className="workspace-transition-status" role="status">{workspaceTransitionCopy(locale, dock.status === 'pending', dock.reason === 'limit')}</p>}
    <div className="workspace-leaf-grid">
      {(['primary', 'secondary'] as const).map(group => <div key={group} className={`workspace-group-heading ${group}`}>
        <WorkspaceLeafTabs state={dock.state} group={group} label={dock.label} onSelect={dock.select} onClose={dock.close} onMove={dock.move} onReorder={dock.reorder} panelId={`${id}-${group}`} pending={dock.status === 'pending'} />
      </div>)}
      <div className="workspace-writing-leaf" hidden={!writing || Boolean(revealed?.group === 'primary' && revealed.reference.kind !== 'note')} id={writing ? `${id}-primary` : undefined}>{children}</div>
      {dock.state.leaves.filter(leaf => leaf.reference.kind !== 'note' || leaf.group === 'secondary' || !dock.visited.has(leaf.id)).map(leaf => {
        const ref = leaf.reference
        if (ref.kind === 'feature' && ref.id === 'editor') return null
        const view = ref.kind === 'plugin' ? plugins.contributions.workspaces.find(view => `${view.pluginId}:${view.id}` === ref.id) ?? null : null
        const active = ref.kind === 'plugin' ? 'plugin' : ref.kind === 'feature' ? featureIds[ref.id] ?? null : null
        return <div key={leaf.id} id={visible(leaf.id, leaf.group) ? `${id}-${leaf.group}` : undefined} className={`workspace-leaf-content ${leaf.group}`} hidden={!visible(leaf.id, leaf.group)} data-leaf-id={leaf.id}>
          {!dock.visited.has(leaf.id) ? <div className="workspace-restore-prompt"><p>{copy.restore}</p><button type="button" onClick={() => { void dock.select(leaf.id) }}>{copy.open}</button></div> : !vaultId ? null : <WorkspaceLeafLifecycleProvider lifecycle={dock.lifecycle} leafId={leaf.id} onReveal={() => dock.reveal(leaf.id)}><WorkspaceEmbeddedPanel>
            {ref.kind === 'source' || (ref.kind === 'feature' && ref.id === 'source-editor') ? <SourceFileWorkspace selection={{ vaultId, path: ref.kind === 'source' ? ref.path : null }} onClose={() => { void dock.close(leaf.id) }} onSaved={workspace.refreshVault} latexConfig={workspace.vaultConfig.latex} />
              : ref.kind === 'note' ? <WorkspaceNotePreview path={ref.path} vaultId={vaultId} onOpen={() => { void dock.move(leaf.id, 'primary').then(approved => { if (approved) void dock.select(leaf.id) }) }} />
                : ref.kind === 'plugin' && !view ? <p role="alert">{copy.unavailable}</p> : <ReviewFeatureWorkspaces active={active} workspace={{ ...workspace, openNote: dock.openNote }} onClose={() => { void dock.close(leaf.id) }} onOpenAsset={onOpenAsset} pluginWorkspace={view} pluginPolicy={view ? plugins.pluginPolicies[view.pluginId] ?? null : null} onNavigate={async route => { await onNavigate(route); await dock.close(leaf.id) }} onPluginCommand={onPluginCommand} />}
          </WorkspaceEmbeddedPanel></WorkspaceLeafLifecycleProvider>}
        </div>
      })}
    </div>
  </section>
}
