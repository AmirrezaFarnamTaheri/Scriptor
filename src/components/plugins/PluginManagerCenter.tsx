import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Palette, Blocks, Plus, Wrench, X } from 'lucide-react'
import type { PluginManifest } from '@scriptor/core/contracts/plugin'
import { canvasPluginManifest } from '@scriptor/canvas'
import { citationsPluginManifest } from '../inspector/citation-plugin-manifest'
import { exportPluginManifest } from '@scriptor/export'
import { mcpPluginManifest } from '@scriptor/mcp'
import { usePluginState } from '../../context/PluginStateContext'
import {
  type InstallerProfile,
  applyProfileToEnabledPlugins,
  getMatchingInstallerProfile,
} from '../../context/plugin-defaults'
import { COLOR_PALETTE_SCHEMES, type ColorPaletteScheme } from '../../brand/palettes'
import { useAppTheme, readStoredCustomThemes, type AppTheme } from '../../hooks/useAppTheme'
import { PluginCard } from './PluginCard'
import { ThemeCard } from '../themes/ThemeCard'
import { ThemeCustomizerModal } from '../themes/ThemeCustomizerModal'
import '../../styles/components/plugin-manager.css'
import { useTablistKeys } from '../../hooks/useTablistKeys'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { useEscapeToClose } from '../../hooks/useEscapeToClose'

const BUILTIN_PLUGIN_MANIFESTS: PluginManifest[] = [
  canvasPluginManifest,
  citationsPluginManifest,
  exportPluginManifest,
  {
    id: 'scriptor.graph',
    name: 'Interactive Knowledge Graph',
    version: '1.0.0',
    description: 'Vault link topology and Cytoscape force-directed layout rendering',
    publisher: 'Scriptor Team',
    capabilityId: 'graph',
    rustFeatureGate: 'scriptor-indexer',
    activation: ['on-startup'],
    capabilities: ['renderer-extension'],
    permissions: [{ permission: 'read', reason: 'Access graph links' }],
  },
  mcpPluginManifest,
]

const TOOL_AND_FEATURE_CATALOG = [
  { name: 'Command palette', kind: 'Tool', description: 'Search commands, notes, and actions from one keyboard-first surface.' },
  { name: 'Knowledge graph', kind: 'Feature', description: 'Explore connected notes and rebuild the local index.' },
  { name: 'Canvas workspace', kind: 'Tool', description: 'Arrange notes and links spatially in a visual workspace.' },
  { name: 'MCP connections', kind: 'Tool', description: 'Review and control connected tool servers and their capabilities.' },
  { name: 'Export profiles', kind: 'Feature', description: 'Create local publishing outputs and inspect export history.' },
  { name: 'Feature profiles', kind: 'Feature', description: 'Enable only the modules that suit the current workflow.' },
]

export interface PluginManagerCenterProps {
  isOpen: boolean
  onClose: () => void
  currentTheme?: AppTheme
  onThemeChange?: (theme: AppTheme) => void
  onOpenPluginMarketplace?: () => void
}

export function PluginManagerCenter({
  isOpen,
  onClose,
  currentTheme: propTheme,
  onThemeChange,
  onOpenPluginMarketplace,
}: PluginManagerCenterProps) {
  const {
    enabledPluginIds,
    enablePlugin,
    disablePlugin,
    replaceEnabledPlugins,
    persistenceError,
  } = usePluginState()
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
  const [activeTab, setActiveTab] = useState<'palettes' | 'plugins' | 'tools'>('palettes')
  const PMC_TABS: readonly string[] = ['palettes', 'plugins', 'tools']
  const handlePmcTabKeys = useTablistKeys(
    PMC_TABS,
    activeTab,
    useCallback((id: string) => setActiveTab(id as 'palettes' | 'plugins' | 'tools'), []),
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [themeFilterCategory, setThemeFilterCategory] = useState<'all' | 'light' | 'dark' | 'contrast'>('all')
  const [customizerModalOpen, setCustomizerModalOpen] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)
  // The nested ThemeCustomizerModal owns the focus trap while it is open.
  useFocusTrap(overlayRef, { active: isOpen && !customizerModalOpen })
  useEscapeToClose(isOpen && !customizerModalOpen, onClose)

  useEffect(() => {
    if (!isOpen) document.documentElement.dataset.theme = activeTheme
    return () => {
      document.documentElement.dataset.theme = activeTheme
    }
  }, [activeTheme, isOpen])

  const knownPluginIds = useMemo(
    () => new Set(BUILTIN_PLUGIN_MANIFESTS.map((plugin) => plugin.id)),
    [],
  )

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
  const filteredToolsAndFeatures = TOOL_AND_FEATURE_CATALOG.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.kind.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()),
  )
  const activeProfile = getMatchingInstallerProfile(enabledPluginIds, knownPluginIds)

  const handleTogglePlugin = (id: string, enable: boolean) => {
    if (enable) {
      enablePlugin(id)
    } else {
      disablePlugin(id)
    }
  }

  const applyProfile = (profile: InstallerProfile) => {
    if (profile === 'custom') return
    replaceEnabledPlugins(applyProfileToEnabledPlugins(enabledPluginIds, knownPluginIds, profile))
  }

  return (
    <>
      <div
        ref={overlayRef}
        className="plugin-manager-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Built-in modules and themes"
      >
        <div className="plugin-manager-modal">
          <div className="plugin-manager-header">
            <h2>
              <Palette /> Built-in Modules &amp; Color Palettes
            </h2>
            <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
              <X />
            </button>
          </div>
          {onOpenPluginMarketplace ? (
            <button type="button" className="toolbar-button plugin-marketplace-link" onClick={onOpenPluginMarketplace}>
              Open runtime plugin marketplace
            </button>
          ) : null}
          {persistenceError ? <p className="error-state" role="alert">{persistenceError}</p> : null}

          {/* Primary Tabs — Color Palette Store active by default */}
          <div className="plugin-manager-tabs" role="tablist" onKeyDown={handlePmcTabKeys} aria-label="Plugin manager sections">
            <button
              type="button"
              role="tab"
              tabIndex={activeTab === 'palettes' ? 0 : -1}
              aria-selected={activeTab === 'palettes'}
              className={`tab-btn ${activeTab === 'palettes' ? 'active' : ''}`}
              onClick={() => setActiveTab('palettes')}
            >
              <Palette /> Color Palette Schemes ({allPalettes.length})
            </button>
            <button
              type="button"
              role="tab"
              tabIndex={activeTab === 'plugins' ? 0 : -1}
              aria-selected={activeTab === 'plugins'}
              className={`tab-btn ${activeTab === 'plugins' ? 'active' : ''}`}
              onClick={() => setActiveTab('plugins')}
            >
              <Blocks /> Feature Plugins &amp; Profiles
            </button>
            <button
              type="button"
              role="tab"
              tabIndex={activeTab === 'tools' ? 0 : -1}
              aria-selected={activeTab === 'tools'}
              className={`tab-btn ${activeTab === 'tools' ? 'active' : ''}`}
              onClick={() => setActiveTab('tools')}
            >
              <Wrench /> Tools &amp; Features
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
            <div className="plugin-manager-profiles palette-filter-row">
              <div className="palette-filter-options">
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
                className="profile-btn create-palette-button"
                onClick={() => setCustomizerModalOpen(true)}
              >
                <Plus size={14} /> Create Custom Palette
              </button>
            </div>
          )}

          <div className="plugin-manager-search">
            <input
              type="search"
              aria-label="Search plugins by name or capability"
              placeholder={
                activeTab === 'palettes'
                  ? 'Search color palette schemes by name or theme style...'
                  : activeTab === 'plugins'
                    ? 'Search plugins by name or capability...'
                    : 'Search tools and features...'
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {activeTab === 'palettes' ? (
            <div className="theme-palette-grid">
              {filteredPalettes.length === 0 ? (
                <p className="plugin-manager-empty" role="status">No color schemes match this search.</p>
              ) : filteredPalettes.map((scheme) => (
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
          ) : activeTab === 'plugins' ? (
            <div className="plugin-manager-list">
              {filteredPlugins.length === 0 ? (
                <p className="plugin-manager-empty" role="status">No plugins match this search.</p>
              ) : filteredPlugins.map((plugin) => (
                <PluginCard
                  key={plugin.id}
                  manifest={plugin}
                  isEnabled={enabledPluginIds.has(plugin.id)}
                  onToggle={handleTogglePlugin}
                />
              ))}
            </div>
          ) : (
            <div className="plugin-manager-list">
              {filteredToolsAndFeatures.length === 0 ? (
                <p className="plugin-manager-empty" role="status">No tools or features match this search.</p>
              ) : filteredToolsAndFeatures.map((item) => (
                <article className="plugin-card" key={item.name}>
                  <div className="plugin-card-info">
                    <div className="plugin-card-title"><Wrench size={18} /><h3>{item.name}</h3><span className="plugin-badge">{item.kind}</span></div>
                    <p className="plugin-card-description">{item.description}</p>
                  </div>
                </article>
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
