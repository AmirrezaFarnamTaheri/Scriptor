import React from 'react'
import type { PluginManifest } from '@scriptor/core/contracts/plugin'

export interface PluginCardProps {
  manifest: PluginManifest
  isEnabled: boolean
  onToggle: (id: string, enabled: boolean) => void
}

export function PluginCard({ manifest, isEnabled, onToggle }: PluginCardProps) {
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
        <button
          type="button"
          aria-label={`Toggle ${manifest.name}`}
          className={`toggle-switch ${isEnabled ? 'enabled' : ''}`}
          onClick={() => onToggle(manifest.id, !isEnabled)}
        >
          <span className="toggle-switch-handle" />
        </button>
      </div>
    </div>
  )
}
