import { useState } from 'react'
import { Palette, Blocks, Plus } from 'lucide-react'
import type { PluginManifest } from '@scriptor/core/contracts/plugin'
import { canvasPluginManifest } from '@scriptor/canvas'
import { citationsPluginManifest } from '../inspector/citation-plugin-manifest'
import { exportPluginManifest } from '@scriptor/export'
import { mcpPluginManifest } from '@scriptor/mcp'
import { usePluginState } from '../../context/PluginStateContext'
import {
  type InstallerProfile,
  getProfilePluginIds,
} from '../../context/plugin-defaults'
import { COLOR_PALETTE_SCHEMES, type ColorPaletteScheme } from '../../brand/palettes'
import { useAppTheme, readStoredCustomThemes, type AppTheme } from '../../hooks/useAppTheme'
import { PluginCard } from './PluginCard'
import { ThemeCard } from '../themes/ThemeCard'
import { ThemeCustomizerModal } from '../themes/ThemeCustomizerModal'
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
    activation: ['on-startup'],
    capabilities: ['renderer-extension'],
    permissions: [{ permission: 'read', reason: 'Access graph links' }],
  },
  mcpPluginManifest,
]

export interface PluginManagerCenterProps {
  isOpen: boolean
  onClose: () => void
  currentTheme?: AppTheme
  onThemeChange?: (theme: AppTheme) => void
}

export function PluginManagerCenter({
  isOpen,
  onClose,
  currentTheme: propTheme,
  onThemeChange,
}: PluginManagerCenterProps) {
  const { enabledPluginIds, enablePlugin, disablePlugin } = usePluginState()
  const { theme: hookTheme, setTheme: hookSetTheme } = useAppTheme()

  const activeTheme = propTheme ?? hookTheme
  const handleSelectTheme = (nextTheme: AppTheme) => {
    if (onThemeChange) {
      onThemeChange(nextTheme)
    } else {
      hookSetTheme(nextTheme)
    }
  }

  // Active Tab: 'palettes' is ACTIVE BY DEFAULT per user specification
  const [activeTab, setActiveTab] = useState<'palettes' | 'plugins'>('palettes')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeProfile, setActiveProfile] = useState<InstallerProfile>('complete')
  const [themeFilterCategory, setThemeFilterCategory] = useState<'all' | 'light' | 'dark' | 'contrast'>('all')
  const [customizerModalOpen, setCustomizerModalOpen] = useState(false)

  if (!isOpen) return null

  const handleHoverPreviewStart = (previewId: AppTheme) => {
    document.documentElement.dataset.theme = previewId
  }

  const handleHoverPreviewEnd = () => {
    document.documentElement.dataset.theme = activeTheme
  }

  const customPalettes: ColorPaletteScheme[] = readStoredCustomThemes().map((c) => ({
    id: c.id,
    name: c.name,
    category: c.category,
    description: 'Custom user-created color palette scheme.',
    author: 'Custom (You)',
    colors: c.colors,
  }))

  const allPalettes = [...COLOR_PALETTE_SCHEMES, ...customPalettes]

  const filteredPalettes = allPalettes.filter((scheme) => {
    const matchesCategory = themeFilterCategory === 'all' || scheme.category === themeFilterCategory
    const matchesSearch =
      scheme.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      scheme.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      scheme.author.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const filteredPlugins = BUILTIN_PLUGIN_MANIFESTS.filter(
    (plugin) =>
      plugin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plugin.description.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const handleTogglePlugin = (id: string, enable: boolean) => {
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
    <>
      <div
        className="plugin-manager-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Extension & Theme Management Center"
      >
        <div className="plugin-manager-modal">
          <div className="plugin-manager-header">
            <h2>
              <Palette /> Extension &amp; Color Scheme Installer Center
            </h2>
            <button type="button" className="close-button" onClick={onClose} aria-label="Close modal">
              ✕
            </button>
          </div>

          {/* Primary Tabs — Color Palette Store active by default */}
          <div className="plugin-manager-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'palettes'}
              className={`tab-btn ${activeTab === 'palettes' ? 'active' : ''}`}
              onClick={() => setActiveTab('palettes')}
            >
              <Palette /> Color Palette Schemes ({allPalettes.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'plugins'}
              className={`tab-btn ${activeTab === 'plugins' ? 'active' : ''}`}
              onClick={() => setActiveTab('plugins')}
            >
              <Blocks /> Feature Plugins &amp; Profiles
            </button>
          </div>

          {activeTab === 'plugins' && (
            <div className="plugin-manager-profiles">
              <span className="profiles-label">Installer Profile Preset:</span>
              {(['focused', 'minimal', 'writer', 'scientific', 'researcher', 'developer', 'complete'] as const).map(
                (profile) => (
                  <button
                    key={profile}
                    type="button"
                    className={`profile-btn ${activeProfile === profile ? 'active' : ''}`}
                    onClick={() => applyProfile(profile)}
                  >
                    {profile.charAt(0).toUpperCase() + profile.slice(1)}
                  </button>
                ),
              )}
              {activeProfile === 'custom' ? <span className="profile-custom-badge">Custom</span> : null}
            </div>
          )}

          {activeTab === 'palettes' && (
            <div className="plugin-manager-profiles" style={{ justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="profiles-label">Category Filter:</span>
                {(['all', 'dark', 'light', 'contrast'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`profile-btn ${themeFilterCategory === cat ? 'active' : ''}`}
                    onClick={() => setThemeFilterCategory(cat)}
                  >
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="profile-btn active"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'var(--primary, #38bdf8)',
                  color: 'var(--bg, #0f172a)',
                  fontWeight: 700,
                }}
                onClick={() => setCustomizerModalOpen(true)}
              >
                <Plus size={14} /> Create Custom Palette
              </button>
            </div>
          )}

          <div className="plugin-manager-search">
            <input
              type="search"
              placeholder={
                activeTab === 'palettes'
                  ? 'Search color palette schemes by name or theme style...'
                  : 'Search plugins by name or capability...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {activeTab === 'palettes' ? (
            <div className="theme-palette-grid">
              {filteredPalettes.map((scheme) => (
                <ThemeCard
                  key={scheme.id}
                  scheme={scheme}
                  isActive={activeTheme === scheme.id}
                  onSelect={handleSelectTheme}
                  onHoverPreviewStart={handleHoverPreviewStart}
                  onHoverPreviewEnd={handleHoverPreviewEnd}
                />
              ))}
            </div>
          ) : (
            <div className="plugin-manager-list">
              {filteredPlugins.map((plugin) => (
                <PluginCard
                  key={plugin.id}
                  manifest={plugin}
                  isEnabled={enabledPluginIds.has(plugin.id)}
                  onToggle={handleTogglePlugin}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <ThemeCustomizerModal
        isOpen={customizerModalOpen}
        onClose={() => setCustomizerModalOpen(false)}
        onSelectTheme={handleSelectTheme}
      />
    </>
  )
}
