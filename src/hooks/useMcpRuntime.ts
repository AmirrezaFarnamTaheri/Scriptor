import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { mutateVaultConfig } from '../lib/vaultConfigMutation'

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
  vaultId: string | undefined,
  vaultConfig: VaultConfig,
  setVaultConfig: (updater: (current: VaultConfig) => VaultConfig) => void,
  activePath: string | null,
  activeContentHash: string | null,
  pluginExportProfiles: ExportProfileContribution[] = [],
  pluginMcpTools: McpToolContribution[] = [],
  pluginCommandRuntime?: PluginCommandRuntime,
  canExecutePluginCommand?: (
    pluginId: string,
    permission: import('@scriptor/core/contracts/plugin').PluginPermission['permission'],
  ) => boolean,
  hibernated: boolean = false,
) {
  const mode = normalizeMcpMode(
    vaultConfig?.mcp?.mode,
    vaultConfig?.mcp?.disabled === true || !vaultOpen || hibernated,
  )
  const [lastResult, setLastResult] = useState<CommandResult | null>(null)
  const [snapshot, setSnapshot] = useState(0)
  const mcpMutationRevisionRef = useRef(0)
  const optimisticMcpRef = useRef(vaultConfig.mcp)

  useEffect(() => {
    optimisticMcpRef.current = vaultConfig.mcp
  }, [vaultConfig.mcp])

  useEffect(() => {
    mcpMutationRevisionRef.current += 1
    optimisticMcpRef.current = vaultConfig.mcp
  }, [vaultId])

  const exportProfiles = useMemo(
    () => mergePluginExportProfiles(DEFAULT_EXPORT_PROFILES, pluginExportProfiles),
    [pluginExportProfiles],
  )

  const persistMcpConfig = useCallback(
    (nextMode: McpMode) => {
      const nextMcp = {
        mode: nextMode === 'off' ? 'off' as const : nextMode,
        disabled: nextMode === 'off',
      }
      const previousMcp = optimisticMcpRef.current
      const revision = ++mcpMutationRevisionRef.current

      optimisticMcpRef.current = nextMcp
      setVaultConfig((current) => ({ ...current, mcp: nextMcp }))
      if (vaultOpen) {
        void mutateVaultConfig((current) => ({ ...current, mcp: nextMcp })).catch((error: unknown) => {
          if (revision === mcpMutationRevisionRef.current) {
            optimisticMcpRef.current = previousMcp
            setVaultConfig((current) => ({ ...current, mcp: previousMcp }))
          }
          setLastResult({
            ok: false,
            requestId: crypto.randomUUID(),
            error: {
              code: 'mcp.config_save_failed',
              message: error instanceof Error ? error.message : 'Could not save MCP permissions',
              recoverable: true,
            },
          })
          setSnapshot((value) => value + 1)
        })
      }
    },
    [setVaultConfig, vaultOpen],
  )

  const setMode = useCallback(
    (nextMode: McpMode) => {
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
      vaultId,
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
      renameNote: (from, to, updateLinks, expectedSourceHash) =>
        vaultRenameApply(from, to, updateLinks ?? true, expectedSourceHash),
      deleteNote: (path, expectedContentHash) => vaultDeleteNote(path, expectedContentHash),
      renderMarkdown: async (markdown, theme) => {
        const themeId = theme === 'grace' ? 'grace' : 'default'
        const publishPack = await import('@scriptor/plugin-publish-pack')
        const html = await publishPack.renderMarkdownForPublish(markdown, {
          render: (body) => renderMarkdownPipeline(body),
        })
        return publishPack.prepareWeChatHtml(html, publishPack.getPublishThemeCss(themeId))
      },
    }
  }, [exportProfiles, mode, vaultId, vaultOpen])

  const [runtime] = useState(() => new McpRuntime(mode, context))

  useEffect(() => {
    runtime.setMode(mode)
    runtime.setContext(context)
  }, [context, mode, runtime])

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
        if (
          !pluginTool.pluginId ||
          !pluginTool.permission ||
          !canExecutePluginCommand?.(pluginTool.pluginId, pluginTool.permission)
        ) {
          const denied: CommandResult = {
            ok: false,
            requestId: crypto.randomUUID(),
            error: {
              code: 'mcp.plugin_permission_denied',
              message: `Plugin tool ${pluginTool.name} is not authorized for the active vault`,
              recoverable: true,
            },
          }
          setLastResult(denied)
          bump()
          return denied
        }
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
    [activePath, bump, canExecutePluginCommand, pluginCommandRuntime, pluginMcpTools, runtime],
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
      pluginMcpTools
        .filter(
          (tool) =>
            Boolean(tool.pluginId && tool.permission) &&
            Boolean(canExecutePluginCommand?.(tool.pluginId!, tool.permission!)),
        )
        .map((tool) => ({
        name: tool.name,
        description: tool.label,
        modeRequired: tool.modeRequired,
        commandId: tool.commandId,
        inputSchema: { type: 'object' as const, properties: {}, additionalProperties: true },
      })),
    [canExecutePluginCommand, pluginMcpTools],
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
