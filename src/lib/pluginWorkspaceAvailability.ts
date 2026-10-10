import type { PluginRuntimePolicy } from '@scriptor/core/contracts/plugin'
import { authorizeWorkspaceView, type PluginWorkspaceDefinition } from '@scriptor/plugin-api'

export function pluginWorkspaceUnavailableReason(
  view: PluginWorkspaceDefinition,
  registered: readonly PluginWorkspaceDefinition[],
  policy: PluginRuntimePolicy | null | undefined,
  vaultId: string | null,
  safeMode: boolean,
): string | null {
  if (safeMode) return 'Plugin workspaces are unavailable in safe mode.'
  if (!policy || !policy.grantedPermissions.includes('read')) return 'Review this plugin’s permissions in the marketplace first.'
  try { authorizeWorkspaceView(view, policy, vaultId) } catch (error) {
    return error instanceof Error ? error.message : 'Workspace permission is unavailable.'
  }
  if (!registered.some(candidate => candidate.pluginId === view.pluginId && candidate.id === view.id)) return 'This workspace is not registered for the current vault.'
  return null
}
