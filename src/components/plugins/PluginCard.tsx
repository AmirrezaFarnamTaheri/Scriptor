import type { PluginManifest } from '@scriptor/core/contracts/plugin'
import type { PluginWorkspaceDefinition } from '@scriptor/plugin-api'
import { useI18n } from '../../lib/i18n'
import { pluginWorkspaceStrings } from '../../lib/i18n/pluginWorkspaceStrings'

export interface PluginCardProps {
  manifest: PluginManifest
  isEnabled: boolean
  onToggle: (id: string, enabled: boolean) => void
  workspaces?: readonly { view: PluginWorkspaceDefinition; unavailableReason: string | null }[]
  onOpenWorkspace?: (view: PluginWorkspaceDefinition) => void
  openingWorkspace?: boolean
  toggling?: boolean
}

export function PluginCard({ manifest, isEnabled, onToggle, workspaces = [], onOpenWorkspace, openingWorkspace = false, toggling = false }: PluginCardProps) {
  const { locale } = useI18n()
  const strings = pluginWorkspaceStrings(locale)
  return (
    <div className="plugin-card">
      <div className="plugin-card-info">
        <div className="plugin-card-title">
          <h3>{manifest.name}</h3>
          <span className="plugin-badge">v{manifest.version}</span>
          {manifest.capabilityId ? (
            <span className="plugin-badge capability-badge">{manifest.capabilityId}</span>
          ) : null}
        </div>
        <p className="plugin-card-description">{manifest.description}</p>
      </div>
      <div className="plugin-card-actions">
        {workspaces.map(({ view, unavailableReason }) => (
          <div key={view.id}>
            <button type="button" className="toolbar-button" disabled={openingWorkspace || !!unavailableReason || !onOpenWorkspace} title={unavailableReason ?? view.description} onClick={() => onOpenWorkspace?.(view)}>
              {strings.open} {view.title}
            </button>
            {unavailableReason ? <small className="plugin-workspace-unavailable">{unavailableReason}</small> : null}
          </div>
        ))}
        <button
          type="button"
          aria-label={`Toggle ${manifest.name}`}
          aria-pressed={isEnabled}
          disabled={toggling}
          className={`toggle-switch ${isEnabled ? 'enabled' : ''}`}
          onClick={() => onToggle(manifest.id, !isEnabled)}
        >
          <span className="toggle-switch-handle" />
        </button>
      </div>
    </div>
  )
}
