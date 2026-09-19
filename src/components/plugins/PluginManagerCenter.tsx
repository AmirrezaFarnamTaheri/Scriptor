import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Palette, Blocks, Plus, X } from 'lucide-react'
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
import { applyThemeToElement, readStoredCustomThemes, type AppTheme, type AppearanceMode, type ResolvedAppearance } from '../../hooks/useAppTheme'
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
    capabilityId: 'scriptor.graph',
    rustFeatureGate: 'scriptor-indexer',
    activation: ['on-startup'],
    capabilities: ['renderer-extension'],
    permissions: [{ permission: 'read', reason: 'Access graph links' }],
  },
  mcpPluginManifest,
]

export interface PluginManagerCenterProps {
  isOpen: boolean
  onClose: () => void
  initialTab?: 'palettes' | 'plugins'
  currentTheme?: AppTheme
  appearance?: AppearanceMode
  resolvedAppearance?: ResolvedAppearance
  onThemeChange?: (theme: AppTheme) => void
  onOpenPluginMarketplace?: () => void
}

export function PluginManagerCenter({
  isOpen,
  onClose,
  initialTab = 'palettes',
  currentTheme: propTheme,
  resolvedAppearance = 'dark',
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
  const activeTheme = propTheme ?? 'dark'
  const handleSelectTheme = (nextTheme: AppTheme) => {
    onThemeChange?.(nextTheme)
  }

  const [activeTab, setActiveTab] = useState<'palettes' | 'plugins'>(initialTab)
  useEffect(() => {
    if (isOpen) setActiveTab(initialTab)
  }, [initialTab, isOpen])
  const PMC_TABS: readonly string[] = ['palettes', 'plugins']
  const handlePmcTabKeys = useTablistKeys(
    PMC_TABS,
    activeTab,
    useCallback((id: string) => setActiveTab(id as 'palettes' | 'plugins'), []),
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [themeFilterCategory, setThemeFilterCategory] = useState<'all' | 'light' | 'dark' | 'contrast'>('all')
  const [customizerModalOpen, setCustomizerModalOpen] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)
  // The nested ThemeCustomizerModal owns the focus trap while it is open.
  useFocusTrap(overlayRef, { active: isOpen && !customizerModalOpen })
  useEscapeToClose(isOpen && !customizerModalOpen, onClose)

  useEffect(() => {
    if (!isOpen) applyThemeToElement(document.documentElement, activeTheme, resolvedAppearance)
    return () => {
      applyThemeToElement(document.documentElement, activeTheme, resolvedAppearance)
    }
  }, [activeTheme, isOpen, resolvedAppearance])

  const knownPluginIds = useMemo(
    () => new Set(BUILTIN_PLUGIN_MANIFESTS.map((plugin) => plugin.id)),
    [],
  )

  if (!isOpen) return null

  const handleHoverPreviewStart = (previewId: AppTheme) => {
    applyThemeToElement(document.documentElement, previewId, resolvedAppearance)
  }

  const handleHoverPreviewEnd = () => {
    applyThemeToElement(document.documentElement, activeTheme, resolvedAppearance)
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
              {activeTab === 'palettes' ? <Palette /> : <Blocks />}
              {activeTab === 'palettes' ? 'Color palettes' : 'Built-in modules'}
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

          {/* The entry point chooses the initial tab; users can still move between both related catalogs. */}
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
                  : 'Search plugins by name or capability...'
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
          ) : (
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
