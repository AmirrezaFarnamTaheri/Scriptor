import type { McpMode } from '@scriptor/core/contracts/mcp'

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

export function runToolScopeTests(): string[] {
  const failures: string[] = []
  const drift = auditToolScopeDrift()
  if (drift.length > 0) {
    failures.push(...drift.map((item) => `tool scope drift: ${item}`))
  }
  if (TOOL_SCOPES['mcp.search'] !== 'read-only') {
    failures.push('mcp.search should require read-only')
  }
  return failures
}
