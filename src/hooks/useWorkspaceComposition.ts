import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { PluginWorkspaceDefinition } from '@scriptor/plugin-api'
import type { PaletteCommand } from '../components/CommandPalette'
import type { useVaultWorkspace } from './useVaultWorkspace'
import type { usePluginRegistry } from './usePluginRegistry'
import { useWorkspaceLeaves } from './useWorkspaceLeaves'
import { getWorkspaceActiveLeaf, type WorkspaceLeafReference } from '../lib/workspaceLeaves'
import { createWorkspaceLeafLifecycle } from '../context/WorkspaceLeafLifecycle'
import { useReviewFeatureWorkspaces } from './useReviewFeatureWorkspaces'
import { sourceLanguage } from '../lib/sourceFile'
import { useI18n } from '../lib/i18n'
import { workspaceCopy } from '../lib/workspaceCopy'
import { useWorkspaceShortcutPreferences } from './useWorkspaceShortcutPreferences'

export function useWorkspaceComposition(workspace: ReturnType<typeof useVaultWorkspace>, plugins: ReturnType<typeof usePluginRegistry>, nativeReady: boolean) {
  const { locale } = useI18n()
  const copy = workspaceCopy(locale)
  const shortcuts = useWorkspaceShortcutPreferences()
  const vaultId = workspace.vault?.id ?? null
  const lifecycle = useMemo(() => createWorkspaceLeafLifecycle(), [])
  const [revealed, setRevealed] = useState<{ vaultId: string | null; id: string } | null>(null)
  const [visited, setVisited] = useState<{ vaultId: string | null; ids: Set<string> }>({ vaultId, ids: new Set() })
  const review = useReviewFeatureWorkspaces(nativeReady && Boolean(vaultId), plugins.contributions.workspaces)
  const refs = useRef({ workspace, plugins, vaultId })
  useLayoutEffect(() => { refs.current = { workspace, plugins, vaultId } }, [workspace, plugins, vaultId])
  const available = useCallback((ref: WorkspaceLeafReference) => {
    if (!vaultId || !nativeReady) return false
    if (ref.kind === 'plugin') return plugins.contributions.workspaces.some(view => `${view.pluginId}:${view.id}` === ref.id)
    if (ref.kind === 'source') return Boolean(sourceLanguage(ref.path))
    if (ref.kind === 'note') return workspace.entries.some(entry => entry.kind === 'note' && entry.path === ref.path)
    return 'id' in ref && (ref.id === 'editor' || ref.id === 'source-editor' || review.commands.some(command => command.id === ref.id))
  }, [nativeReady, plugins.contributions.workspaces, review.commands, vaultId, workspace.entries])
  const leaves = useWorkspaceLeaves({ vaultId, available, approve: async request => {
    const ownedVault = refs.current.vaultId
    if (!ownedVault) return false
    if (document.querySelector('.workspace-leaf-dock [role="dialog"][aria-modal="true"]')) return false
    if (request.action !== 'close' && document.querySelector('.workspace-leaf-dock [role="alertdialog"]')) return false
    if (request.action === 'move' && request.from?.reference.kind === 'feature' && request.from.reference.id === 'editor') return false
    for (const removed of request.previous.leaves.filter(leaf => !request.next.leaves.some(next => next.id === leaf.id))) {
      if (request.action === 'close' && removed.id === request.from?.id) continue
      setRevealed({ vaultId: ownedVault, id: removed.id })
      if (!await lifecycle.requestClose(removed.id) || refs.current.vaultId !== ownedVault) return false
    }
    if (request.action === 'close' && request.from) {
      setRevealed({ vaultId: ownedVault, id: request.from.id })
      const approved = await lifecycle.requestClose(request.from.id)
      if (!approved || refs.current.vaultId !== ownedVault) return false
      if (request.from.reference.kind === 'note' && !await refs.current.workspace.closeTab(request.from.reference.path)) return false
    }
    const primary = getWorkspaceActiveLeaf(request.next, 'primary')
    if (primary?.reference.kind === 'note' && primary.reference.path !== refs.current.workspace.activePath) {
      if (!await refs.current.workspace.openNote(primary.reference.path) || refs.current.vaultId !== ownedVault) return false
    }
    return true
  }, onCommitted: request => {
    setRevealed(null)
    if ((request.action === 'open' || request.action === 'select') && request.to) {
      const ownedVault = refs.current.vaultId
      setVisited(current => ({ vaultId: ownedVault, ids: new Set([...(current.vaultId === ownedVault ? current.ids : []), request.to!.id]) }))
    }
  } })
  const commands = useMemo<PaletteCommand[]>(() => review.commands.map(command => ({ ...command, run: () => {
    const view = plugins.contributions.workspaces.find(view => `workspace:${view.pluginId}:${view.id}` === command.id)
    void leaves.open(view ? { kind: 'plugin', id: `${view.pluginId}:${view.id}` } : { kind: 'feature', id: command.id }, 'secondary')
  } })), [leaves, plugins.contributions.workspaces, review.commands])
  const openSource = useCallback((path: string | null) => {
    void leaves.open(path ? { kind: 'source', path } : { kind: 'feature', id: 'source-editor' }, 'secondary')
  }, [leaves])
  const openPlugin = useCallback((view: PluginWorkspaceDefinition) => leaves.open({ kind: 'plugin', id: `${view.pluginId}:${view.id}` }, 'secondary'), [leaves])
  const openNote = useCallback(async (path: string) => {
    const existing = leaves.state.leaves.find(leaf => leaf.reference.kind === 'note' && leaf.reference.path === path)
    if (existing?.group === 'secondary') return await leaves.move(existing.id, 'primary') && await leaves.select(existing.id)
    return leaves.open({ kind: 'note', path }, 'primary')
  }, [leaves])
  const closeNote = useCallback((path: string) => {
    const leaf = leaves.state.leaves.find(leaf => leaf.reference.kind === 'note' && leaf.reference.path === path)
    return leaf ? leaves.close(leaf.id) : workspace.closeTab(path)
  }, [leaves, workspace])
  const sourceCommands = useMemo<PaletteCommand[]>(() => vaultId && nativeReady ? [
    { id: 'open-source-file-editor', label: 'Source file editor', category: 'Workspace', keywords: ['latex', 'python', 'code', 'Overleaf'], run: () => openSource(null) },
    { id: 'customize-workspace-shortcuts', label: locale === 'de' ? 'Arbeitsbereich-Verknüpfungen anpassen' : locale === 'fa' ? 'سفارشی‌سازی میانبرهای فضای کاری' : 'Customize workspace shortcuts', category: 'Workspace', keywords: ['Customize workspace shortcuts', 'hide', 'pin', 'rename', 'resize', 'toolbar'], run: shortcuts.show },
  ] : [], [locale, nativeReady, openSource, shortcuts.show, vaultId])
  return { ...leaves, commands, sourceCommands, openSource, openPlugin, openNote, closeNote, lifecycle, shortcuts,
    managerProps: { registeredWorkspaces: plugins.contributions.workspaces, registeredPluginManifests: plugins.plugins.map(plugin => plugin.manifest), workspacePolicies: plugins.pluginPolicies, vaultId, safeMode: plugins.snapshot.safeMode, onOpenPluginWorkspace: openPlugin, onSetPluginEnabled: plugins.setPluginEnabled },
    visited: visited.vaultId === vaultId ? visited.ids : new Set<string>(),
    revealed: revealed?.vaultId === vaultId ? revealed.id : null,
    reveal: (id: string) => setRevealed({ vaultId, id }),
    label: (ref: WorkspaceLeafReference) => 'path' in ref ? ref.path : ref.kind === 'plugin' ? plugins.contributions.workspaces.find(view => `${view.pluginId}:${view.id}` === ref.id)?.title ?? copy.unavailable : ref.id === 'editor' ? copy.writing : ref.id === 'source-editor' ? copy.source : review.commands.find(command => command.id === ref.id)?.label ?? copy.unavailable,
  }
}
