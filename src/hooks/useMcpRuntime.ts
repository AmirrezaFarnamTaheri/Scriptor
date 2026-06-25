import { useCallback, useEffect, useMemo, useState } from 'react'
import type { McpMode, McpToolDescriptor } from '@scriptor/core'
import type { CommandResult } from '@scriptor/core'
import type { McpToolContribution } from '@scriptor/core/contracts/plugin'
import { DEFAULT_EXPORT_PROFILES, mergePluginExportProfiles } from '@scriptor/export'
import { renderMarkdownPipeline } from '@scriptor/renderer'
import { McpRuntime, modeAllowsTool, nextMcpMode, type DraftPatch, type McpVaultContext } from '@scriptor/mcp'
import type { ExportProfileContribution } from '@scriptor/core/contracts/plugin'

import {
  dispatchPluginCommandIdAsMcpResult,
  type PluginCommandRuntime,
} from '../lib/pluginCommandDispatch'

import {
  indexerBacklinks,
  indexerGraph,
  indexerListDeadEnds,
  indexerListOrphans,
  indexerListTags,
  indexerListUnresolvedTargets,
  indexerNotesForTag,
  indexerSearch,
  indexerTraverseGraph,
  vaultDeleteNote,
  vaultHealthDiagnostics,
  vaultReadNote,
  vaultRenameApply,
  vaultSaveNote,
  vaultSaveConfig,
} from '../bridge/commands'
import type { VaultConfig } from '../types/vault'

function normalizeMcpMode(value: string | undefined, disabled?: boolean): McpMode {
  if (disabled) return 'off'
  if (value === 'off' || value === 'read-only' || value === 'draft' || value === 'write-approved') {
    return value
  }
  return 'read-only'
}

export function useMcpRuntime(
  vaultOpen: boolean,
  vaultConfig: VaultConfig,
  setVaultConfig: (updater: (current: VaultConfig) => VaultConfig) => void,
  activePath: string | null,
  activeContentHash: string | null,
  pluginExportProfiles: ExportProfileContribution[] = [],
  pluginMcpTools: McpToolContribution[] = [],
  pluginCommandRuntime?: PluginCommandRuntime,
) {
  const [mode, setModeState] = useState<McpMode>(() =>
    normalizeMcpMode(vaultConfig.mcp?.mode, vaultConfig.mcp?.disabled),
  )
  const [lastResult, setLastResult] = useState<CommandResult | null>(null)
  const [snapshot, setSnapshot] = useState(0)

  useEffect(() => {
    setModeState(normalizeMcpMode(vaultConfig.mcp?.mode, vaultConfig.mcp?.disabled))
  }, [vaultConfig.mcp?.disabled, vaultConfig.mcp?.mode])

  const exportProfiles = useMemo(
    () => mergePluginExportProfiles(DEFAULT_EXPORT_PROFILES, pluginExportProfiles),
    [pluginExportProfiles],
  )

  const persistMcpConfig = useCallback(
    (nextMode: McpMode) => {
      setVaultConfig((current) => {
        const nextConfig: VaultConfig = {
          ...current,
          mcp: {
            mode: nextMode === 'off' ? 'off' : nextMode,
            disabled: nextMode === 'off',
          },
        }
        if (vaultOpen) {
          void vaultSaveConfig(nextConfig)
        }
        return nextConfig
      })
    },
    [setVaultConfig, vaultOpen],
  )

  const setMode = useCallback(
    (nextMode: McpMode) => {
      setModeState(nextMode)
      persistMcpConfig(nextMode)
    },
    [persistMcpConfig],
  )

  const resetPermissions = useCallback(() => {
    setMode('off')
  }, [setMode])

  const context = useMemo<McpVaultContext | null>(() => {
    if (!vaultOpen || mode === 'off') return null
    return {
      search: (query, limit) => indexerSearch(query, limit ?? 25),
      readNote: (path) => vaultReadNote(path),
      backlinks: (path) => indexerBacklinks(path),
      brokenLinks: async () => {
        const diagnostics = await vaultHealthDiagnostics()
        return diagnostics.issues.filter((issue) => issue.kind === 'broken_link')
      },
      listTags: () => indexerListTags(),
      notesForTag: (tag, limit) => indexerNotesForTag(tag.replace(/^#/, '')).then((notes) =>
        limit && limit > 0 ? notes.slice(0, limit) : notes,
      ),
      exportGraph: (focusPath, depth) => indexerGraph(focusPath, depth ?? 1),
      traverseGraph: (focusPath, depth) => indexerTraverseGraph(focusPath, depth ?? 2),
      listOrphans: () => indexerListOrphans(),
      listDeadEnds: () => indexerListDeadEnds(),
      listUnresolvedTargets: () => indexerListUnresolvedTargets(),
      exportProfiles: async () => exportProfiles,
      saveNote: (path, markdown, expectedContentHash) =>
        vaultSaveNote(path, markdown, expectedContentHash),
      renameNote: (from, to, updateLinks) => vaultRenameApply(from, to, updateLinks ?? true),
      deleteNote: (path) => vaultDeleteNote(path),
      renderMarkdown: async (markdown, theme) => {
        const themeId = theme === 'grace' ? 'grace' : 'default'
        const publishPack = await import('@scriptor/plugin-publish-pack')
        const html = await publishPack.renderMarkdownForPublish(markdown, {
          render: (body) => renderMarkdownPipeline(body),
        })
        return publishPack.prepareWeChatHtml(html, publishPack.getPublishThemeCss(themeId))
      },
    }
  }, [exportProfiles, mode, vaultOpen])

  const runtime = useMemo(() => new McpRuntime(mode, context), [context, mode])

  const cycleMode = useCallback(() => {
    setMode(nextMcpMode(mode))
  }, [mode, setMode])

  const bump = useCallback(() => {
    setSnapshot((value) => value + 1)
  }, [])

  const invokeTool = useCallback(
    async (toolName: string, input: unknown) => {
      const pluginTool = pluginMcpTools.find((tool) => tool.name === toolName)
      if (pluginTool && pluginCommandRuntime) {
        const notePath =
          typeof (input as { path?: string })?.path === 'string'
            ? (input as { path: string }).path
            : activePath
        const pluginResult = await dispatchPluginCommandIdAsMcpResult(
          pluginTool.commandId,
          pluginCommandRuntime,
          { notePath, input },
        )
        setLastResult(pluginResult)
        bump()
        return pluginResult
      }

      const result = await runtime.invoke(toolName, input)
      setLastResult(result)
      bump()
      return result
    },
    [activePath, bump, pluginCommandRuntime, pluginMcpTools, runtime],
  )

  const approveDraft = useCallback(
    async (patchId: string) => {
      const result = await runtime.approveDraft(patchId)
      setLastResult(result)
      bump()
      return result
    },
    [bump, runtime],
  )

  const rejectDraft = useCallback(
    (patchId: string) => {
      const rejected = runtime.rejectDraft(patchId)
      bump()
      return rejected
    },
    [bump, runtime],
  )

  const proposeDraftForActiveNote = useCallback(
    async (proposedMarkdown: string, summary: string) => {
      if (!activePath) return null
      return invokeTool('mcp.proposePatch', {
        path: activePath,
        proposedMarkdown,
        summary,
        baseContentHash: activeContentHash ?? undefined,
      })
    },
    [activeContentHash, activePath, invokeTool],
  )

  const pluginToolDescriptors = useMemo<McpToolDescriptor[]>(
    () =>
      pluginMcpTools.map((tool) => ({
        name: tool.name,
        description: tool.label,
        modeRequired: tool.modeRequired,
        commandId: tool.commandId,
      })),
    [pluginMcpTools],
  )

  const tools = useMemo(() => {
    const base = runtime.listTools()
    const merged = [...base]
    for (const tool of pluginToolDescriptors) {
      if (!merged.some((entry) => entry.name === tool.name)) {
        merged.push(tool)
      }
    }
    return merged.filter((tool) => modeAllowsTool(mode, tool.modeRequired))
  }, [mode, pluginToolDescriptors, runtime, snapshot]) // eslint-disable-line react-hooks/exhaustive-deps
  const audit = useMemo(() => runtime.listAudit(), [runtime, snapshot]) // eslint-disable-line react-hooks/exhaustive-deps
  const drafts = useMemo(() => runtime.listDrafts(), [runtime, snapshot]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    mode,
    setMode,
    cycleMode,
    resetPermissions,
    tools,
    audit,
    drafts: drafts as DraftPatch[],
    lastResult,
    invokeTool,
    approveDraft,
    rejectDraft,
    proposeDraftForActiveNote,
    snapshot,
  }
}
