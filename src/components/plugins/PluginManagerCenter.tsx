import React, { useState } from 'react'
import type { PluginManifest } from '@scriptor/core/contracts/plugin'
import { canvasPluginManifest } from '@scriptor/canvas'
import { citationsPluginManifest } from '../inspector/citation-plugin-manifest.ts'
import { exportPluginManifest } from '@scriptor/export'
import { mcpPluginManifest } from '@scriptor/mcp'
import { usePluginState } from '../../context/PluginStateContext.tsx'
import {
  type InstallerProfile,
  INSTALLER_PROFILES,
  getProfilePluginIds,
} from '../../context/plugin-defaults.ts'
import { PluginCard } from './PluginCard.tsx'
import '../../styles/components/plugin-manager.css'

export const BUILTIN_PLUGIN_MANIFESTS: PluginManifest[] = [
  canvasPluginManifest,
  citationsPluginManifest,
  exportPluginManifest,
  {
    id: 'scriptor.graph',
    name: 'Interactive Knowledge Graph',
    version: '0.1.0',
    description: 'Vault link topology and Cytoscape force-directed layout rendering',
    publisher: 'Scriptor Team',
    capabilityId: 'graph',
    rustFeatureGate: 'scriptor-graph-engine',
  },
  mcpPluginManifest,
]

export interface PluginManagerCenterProps {
  isOpen: boolean
  onClose: () => void
}

export function PluginManagerCenter({ isOpen, onClose }: PluginManagerCenterProps) {
  const { enabledPluginIds, enablePlugin, disablePlugin } = usePluginState()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeProfile, setActiveProfile] = useState<InstallerProfile>('complete')

  if (!isOpen) return null

  const filteredPlugins = BUILTIN_PLUGIN_MANIFESTS.filter(
    (plugin) =>
      plugin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plugin.description.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const handleToggle = (id: string, enable: boolean) => {
    setActiveProfile('custom')
    if (enable) {
      enablePlugin(id)
    } else {
      disablePlugin(id)
    }
  }

  const applyProfile = (profile: InstallerProfile) => {
    setActiveProfile(profile)
    const targetSet = getProfilePluginIds(profile)
    for (const plugin of BUILTIN_PLUGIN_MANIFESTS) {
      if (targetSet.has(plugin.id)) {
        enablePlugin(plugin.id)
      } else {
        disablePlugin(plugin.id)
      }
    }
  }

  return (
    <div className="plugin-manager-overlay" role="dialog" aria-modal="true" aria-label="Plugin Management Center">
      <div className="plugin-manager-modal">
        <div className="plugin-manager-header">
          <h2>Plugin Management Center</h2>
          <button type="button" className="close-button" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        <div className="plugin-manager-profiles">
          <span className="profiles-label">Installer Profile Preset:</span>
          {(['focused', 'minimal', 'writer', 'scientific', 'researcher', 'developer', 'complete'] as const).map((profile) => (
            <button
              key={profile}
              type="button"
              className={`profile-btn ${activeProfile === profile ? 'active' : ''}`}
              onClick={() => applyProfile(profile)}
            >
              {profile.charAt(0).toUpperCase() + profile.slice(1)}
            </button>
          ))}
          {activeProfile === 'custom' ? <span className="profile-custom-badge">Custom</span> : null}
        </div>

        <div className="plugin-manager-search">
          <input
            type="search"
            placeholder="Search plugins by name or capability..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="plugin-manager-list">
          {filteredPlugins.map((plugin) => (
            <PluginCard
              key={plugin.id}
              manifest={plugin}
              isEnabled={enabledPluginIds.has(plugin.id)}
              onToggle={handleToggle}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
