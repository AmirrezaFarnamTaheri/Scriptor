import { useEffect, useMemo, useRef, useState } from 'react'
import { Palette, Blocks, Plus, X } from 'lucide-react'
import type { PluginManifest, PluginRuntimePolicy } from '@scriptor/core/contracts/plugin'
import { runtimeConsoleManifest, type PluginWorkspaceDefinition } from '@scriptor/plugin-api'
import { pluginWorkspaceUnavailableReason } from '../../lib/pluginWorkspaceAvailability'
import { applyPluginManagerTransition } from '../../lib/pluginManagerTransition'
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
import { MutationConfirmation } from '../chrome/MutationConfirmation'
import { ThemeCard } from '../themes/ThemeCard'
import { ThemeCustomizerModal } from '../themes/ThemeCustomizerModal'
import '../../styles/components/plugin-manager.css'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { useEscapeToClose } from '../../hooks/useEscapeToClose'
import { useI18n } from '../../lib/i18n'
import { localizedWorkspaceReason, pluginWorkspaceStrings } from '../../lib/i18n/pluginWorkspaceStrings'

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
  runtimeConsoleManifest,
]

export interface PluginManagerCenterProps {
  isOpen: boolean
  onClose: () => void
  scope?: 'palettes' | 'plugins'
  currentTheme?: AppTheme
  appearance?: AppearanceMode
  resolvedAppearance?: ResolvedAppearance
  onThemeChange?: (theme: AppTheme) => void
  onOpenPluginMarketplace?: () => void
  registeredWorkspaces?: readonly PluginWorkspaceDefinition[]
  workspacePolicies?: Readonly<Record<string, PluginRuntimePolicy | null>>
  vaultId?: string | null
  safeMode?: boolean
  onOpenPluginWorkspace?: (view: PluginWorkspaceDefinition) => boolean | Promise<boolean>
  registeredPluginManifests?: readonly PluginManifest[]
  onSetPluginEnabled?: (id: string, enabled: boolean) => Promise<boolean>
}

export function PluginManagerCenter({
  isOpen,
  onClose,
  scope = 'palettes',
  currentTheme: propTheme,
  resolvedAppearance = 'dark',
  onThemeChange,
  onOpenPluginMarketplace,
  registeredWorkspaces = [], workspacePolicies = {}, vaultId = null, safeMode = false, onOpenPluginWorkspace, registeredPluginManifests = [], onSetPluginEnabled,
}: PluginManagerCenterProps) {
  const { t, locale } = useI18n()
  const workspaceStrings = pluginWorkspaceStrings(locale)
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

  const [searchQuery, setSearchQuery] = useState('')
  const [workspaceError, setWorkspaceError] = useState<string | null>(null)
  const [workspaceOpening, setWorkspaceOpening] = useState(false)
  const openingRef = useRef(false)
  const [togglingPlugin, setTogglingPlugin] = useState<string | null>(null)
  const togglePending = useRef(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const [themeFilterCategory, setThemeFilterCategory] = useState<'all' | 'light' | 'dark' | 'contrast'>('all')
  const [customizerModalOpen, setCustomizerModalOpen] = useState(false)
  const [pendingProfile, setPendingProfile] = useState<InstallerProfile | null>(null)
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

  const openWorkspace = async (view: PluginWorkspaceDefinition) => {
    if (openingRef.current) return
    const reason = localizedWorkspaceReason(pluginWorkspaceUnavailableReason(view, registeredWorkspaces, workspacePolicies[view.pluginId], vaultId, safeMode), workspaceStrings)
    if (reason) { setWorkspaceError(reason); return }
    openingRef.current = true
    setWorkspaceOpening(true)
    setWorkspaceError(null)
    try {
      const accepted = await onOpenPluginWorkspace?.(view)
      if (!mounted.current) return
      if (accepted) onClose()
      else setWorkspaceError(workspaceStrings.refused)
    } catch { if (mounted.current) setWorkspaceError(workspaceStrings.failed) }
    finally { openingRef.current = false; if (mounted.current) setWorkspaceOpening(false) }
  }

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
    description: t('pluginManager.customDescription'),
    author: t('pluginManager.customAuthor'),
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

  const pluginManifests = [...new Map([...BUILTIN_PLUGIN_MANIFESTS, ...registeredPluginManifests].map(manifest => [manifest.id, manifest])).values()]
  const filteredPlugins = pluginManifests.filter(
    (plugin) =>
      plugin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plugin.description.toLowerCase().includes(searchQuery.toLowerCase()),
  )
  const activeProfile = getMatchingInstallerProfile(enabledPluginIds, knownPluginIds)

  const handleTogglePlugin = async (id: string, enable: boolean) => {
    if (togglePending.current) return
    togglePending.current = true
    setTogglingPlugin(id)
    setWorkspaceError(null)
    try {
      if (!await applyPluginManagerTransition(id, enable, onSetPluginEnabled, enabled => enabled ? enablePlugin(id) : disablePlugin(id))) {
        if (mounted.current) setWorkspaceError(workspaceStrings.toggleRefused)
        return
      }
    } catch { if (mounted.current) setWorkspaceError(workspaceStrings.toggleFailed) }
    finally { togglePending.current = false; if (mounted.current) setTogglingPlugin(null) }
  }

  const profileTarget = pendingProfile && pendingProfile !== 'custom'
    ? applyProfileToEnabledPlugins(enabledPluginIds, knownPluginIds, pendingProfile)
    : null
  const profileDiff = profileTarget
    ? {
        enable: [...profileTarget].filter((id) => !enabledPluginIds.has(id)).length,
        disable: [...enabledPluginIds].filter((id) => knownPluginIds.has(id) && !profileTarget.has(id)).length,
      }
    : null

  const requestProfile = (profile: InstallerProfile) => {
    if (profile === 'custom' || profile === activeProfile) return
    setPendingProfile(profile)
  }

  const confirmProfile = async () => {
    if (!profileTarget || togglePending.current) return
    togglePending.current = true
    setTogglingPlugin('profile')
    setWorkspaceError(null)
    try {
      if (onSetPluginEnabled) {
        for (const id of knownPluginIds) {
          const enabled = profileTarget.has(id)
          const currentEnabled = workspacePolicies[id]?.enabled ?? enabledPluginIds.has(id)
          if (enabled === currentEnabled) continue
          if (!await applyPluginManagerTransition(id, enabled, onSetPluginEnabled, value => value ? enablePlugin(id) : disablePlugin(id))) { setWorkspaceError(workspaceStrings.toggleRefused); return }
        }
      }
      replaceEnabledPlugins(profileTarget)
      setPendingProfile(null)
    } catch { if (mounted.current) setWorkspaceError(workspaceStrings.toggleFailed) }
    finally { togglePending.current = false; if (mounted.current) setTogglingPlugin(null) }
  }

  return (
    <>
      <div
        ref={overlayRef}
        className="plugin-manager-overlay"
        role="dialog"
        aria-modal="true"
        aria-label={scope === 'palettes' ? t('pluginManager.palettesTitle') : t('pluginManager.modulesTitle')}
      >
        <div className="plugin-manager-modal" data-help-topic="modules">
          <div className="plugin-manager-header">
            <h2>
              {scope === 'palettes' ? <Palette /> : <Blocks />}
              {scope === 'palettes' ? t('pluginManager.palettesTitle') : t('pluginManager.modulesTitle')}
            </h2>
            <button type="button" className="icon-button" onClick={onClose} aria-label={t('pluginManager.close')}>
              <X />
            </button>
          </div>
          {scope === 'plugins' && onOpenPluginMarketplace ? (
            <button type="button" className="toolbar-button plugin-marketplace-link" onClick={onOpenPluginMarketplace}>
              {t('pluginManager.marketplace')}
            </button>
          ) : null}
          {scope === 'plugins' && persistenceError ? <p className="error-state" role="alert">{persistenceError}</p> : null}
          {workspaceError ? <p className="error-state" role="alert">{workspaceError}</p> : null}
          {workspaceOpening ? <p role="status">{workspaceStrings.opening}</p> : null}

          {scope === 'plugins' && (
            <div className="plugin-manager-profiles">
              <span className="profiles-label">{t('pluginManager.installerProfile')}</span>
              {(['focused', 'minimal', 'writer', 'scientific', 'researcher', 'developer', 'complete'] as const).map(
                (profile) => (
                  <button
                    key={profile}
                    type="button"
                    className={`profile-btn ${activeProfile === profile ? 'active' : ''}`}
                    aria-pressed={activeProfile === profile}
                    disabled={togglingPlugin !== null}
                    onClick={() => requestProfile(profile)}
                  >
                    {t(`pluginManager.profiles.${profile}`)}
                  </button>
                ),
              )}
              {activeProfile === 'custom' ? <span className="profile-custom-badge">{t('pluginManager.custom')}</span> : null}
              {pendingProfile && profileDiff ? (
                <MutationConfirmation
                  ariaLabel={t('pluginManager.applyProfileAria', { profile: pendingProfile })}
                  message={t('pluginManager.applyProfileMessage', { profile: pendingProfile, enable: profileDiff.enable, disable: profileDiff.disable })}
                  confirmLabel={t('pluginManager.applyProfile')}
                  onCancel={() => setPendingProfile(null)}
                  onConfirm={() => { void confirmProfile() }}
                  className="plugin-profile-confirmation"
                />
              ) : null}
            </div>
          )}

          {scope === 'palettes' && (
            <div className="plugin-manager-profiles palette-filter-row">
              <div className="palette-filter-options">
                <span className="profiles-label">{t('pluginManager.categoryFilter')}</span>
                {(['all', 'dark', 'light', 'contrast'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`profile-btn ${themeFilterCategory === cat ? 'active' : ''}`}
                    aria-pressed={themeFilterCategory === cat}
                    onClick={() => setThemeFilterCategory(cat)}
                  >
                    {t(`pluginManager.categories.${cat}`)}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="profile-btn create-palette-button"
                onClick={() => setCustomizerModalOpen(true)}
              >
                <Plus size={14} /> {t('pluginManager.createPalette')}
              </button>
            </div>
          )}

          <div className="plugin-manager-search">
            <input
              type="search"
              aria-label={scope === 'palettes' ? t('pluginManager.searchPalette') : t('pluginManager.searchAria')}
              placeholder={
                scope === 'palettes'
                  ? t('pluginManager.searchPalette')
                  : t('pluginManager.searchPlugins')
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {scope === 'palettes' ? (
            <div className="theme-palette-grid">
              {filteredPalettes.length === 0 ? (
                <p className="plugin-manager-empty" role="status">{t('pluginManager.noPalettes')}</p>
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
                <p className="plugin-manager-empty" role="status">{t('pluginManager.noPlugins')}</p>
              ) : filteredPlugins.map((plugin) => (
                <PluginCard
                  key={plugin.id}
                  manifest={plugin}
                  isEnabled={workspacePolicies[plugin.id]?.enabled ?? enabledPluginIds.has(plugin.id)}
                  onToggle={(id, enabled) => { void handleTogglePlugin(id, enabled) }}
                  toggling={togglingPlugin !== null}
                  workspaces={(plugin.contributes?.workspaces ?? []).map(view => ({ view, unavailableReason: localizedWorkspaceReason(pluginWorkspaceUnavailableReason(view, registeredWorkspaces, workspacePolicies[view.pluginId], vaultId, safeMode), workspaceStrings) }))}
                  openingWorkspace={workspaceOpening}
                  onOpenWorkspace={onOpenPluginWorkspace ? view => { void openWorkspace(view) } : undefined}
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
