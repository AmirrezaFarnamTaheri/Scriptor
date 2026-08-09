import type { PluginManifest } from '@scriptor/core/contracts/plugin'

export const CITATION_PLUGIN_CAPABILITY_ID = 'citations'
export const CITATION_PLUGIN_ID = 'scriptor.citations'

export const citationsPluginManifest: PluginManifest = {
  id: CITATION_PLUGIN_ID,
  name: 'Zotero & CSL Citations',
  version: '0.1.0',
  description: 'Zotero library synchronization, CSL citation formatting, and bibliography inspector',
  publisher: 'Scriptor Team',
  capabilityId: CITATION_PLUGIN_CAPABILITY_ID,
  rustFeatureGate: 'scriptor-citations-engine',
  activation: ['on-startup'],
  capabilities: ['inspector-widget', 'command'],
  permissions: [{ permission: 'read', reason: 'Read citations' }],
  contributes: {
    inspectorWidgets: [
      {
        id: 'citation-inspector',
        label: 'Citations & Bibliography',
        placement: 'note',
      },
    ],
    commands: [
      {
        commandId: 'citations.insert',
        label: 'Insert Citation',
        category: 'Citations',
        permission: 'read',
      },
      {
        commandId: 'citations.sync',
        label: 'Sync Zotero Library',
        category: 'Citations',
        permission: 'read',
      },
    ],
  },
}

export function isCitationsPluginEnabled(enabledPlugins?: string[]): boolean {
  if (!enabledPlugins) return true
  return enabledPlugins.includes(CITATION_PLUGIN_ID) || enabledPlugins.includes(CITATION_PLUGIN_CAPABILITY_ID)
}
