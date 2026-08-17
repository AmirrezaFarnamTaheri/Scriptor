import type { McpMode } from '@scriptor/core/contracts/mcp'

import { mcpPluginManifest } from './manifest.ts'
import { allMcpTools } from './runtime.ts'

/** Explicit tool → minimum mode map (OpenAlgo-style scope registry). */
export const TOOL_SCOPES: Record<string, McpMode> = Object.fromEntries(
  allMcpTools().map((tool) => [tool.name, tool.modeRequired]),
)

export function toolRequiredMode(toolName: string): McpMode | null {
  return TOOL_SCOPES[toolName] ?? null
}

/** Returns tool names registered in runtime but missing from TOOL_SCOPES (should stay empty). */
export function auditToolScopeDrift(): string[] {
  const registered = new Set(allMcpTools().map((tool) => tool.name))
  const scoped = new Set(Object.keys(TOOL_SCOPES))
  const drift: string[] = []
  for (const name of registered) {
    if (!scoped.has(name)) drift.push(`missing scope: ${name}`)
  }
  for (const name of scoped) {
    if (!registered.has(name)) drift.push(`stale scope: ${name}`)
  }
  return drift
}

/** Enforces 1:1 parity between runtime tool registrations and mcpPluginManifest.contributes.mcpTools */
export function auditManifestDrift(): string[] {
  const tools = allMcpTools()
  const manifestTools = mcpPluginManifest.contributes?.mcpTools ?? []
  const manifestMap = new Map(manifestTools.map((t) => [t.name, t]))
  const registeredMap = new Map(tools.map((t) => [t.name, t]))
  const drift: string[] = []

  for (const tool of tools) {
    const m = manifestMap.get(tool.name)
    if (!m) {
      drift.push(`missing in manifest: ${tool.name}`)
    } else if (m.modeRequired !== tool.modeRequired) {
      drift.push(`manifest mode mismatch for ${tool.name}: manifest has ${m.modeRequired}, runtime has ${tool.modeRequired}`)
    }
  }
  for (const m of manifestTools) {
    if (!registeredMap.has(m.name)) {
      drift.push(`stale tool in manifest: ${m.name}`)
    }
  }
  return drift
}

export function runToolScopeTests(): string[] {
  const failures: string[] = []
  const drift = auditToolScopeDrift()
  if (drift.length > 0) {
    failures.push(...drift.map((item) => `tool scope drift: ${item}`))
  }
  const manifestDrift = auditManifestDrift()
  if (manifestDrift.length > 0) {
    failures.push(...manifestDrift.map((item) => `manifest drift: ${item}`))
  }
  if (TOOL_SCOPES['mcp.search'] !== 'read-only') {
    failures.push('mcp.search should require read-only')
  }
  return failures
}
