import type { PluginManifest } from '@scriptor/core/contracts/plugin'

export const CITATION_PLUGIN_CAPABILITY_ID = 'citations'
export const CITATION_PLUGIN_ID = 'scriptor.citations'

export const citationsPluginManifest: PluginManifest = {
  id: CITATION_PLUGIN_ID,
  name: 'Zotero & CSL Citations',
  version: '0.1.0',
  description: 'Zotero library synchronization, CSL citation formatting, and bibliography inspector',
  author: 'Scriptor Team',
  capabilityId: CITATION_PLUGIN_CAPABILITY_ID,
  rustFeatureGate: 'scriptor-citations-engine',
  contributes: {
    inspectorWidgets: [
      {
        id: 'citation-inspector',
        title: 'Citations & Bibliography',
        location: 'inspector',
      },
    ],
    commands: [
      {
        id: 'citations.insert',
        title: 'Insert Citation',
        category: 'Citations',
      },
      {
        id: 'citations.sync',
        title: 'Sync Zotero Library',
        category: 'Citations',
      },
    ],
  },
}

export function isCitationsPluginEnabled(enabledPlugins?: string[]): boolean {
  if (!enabledPlugins) return true
  return enabledPlugins.includes(CITATION_PLUGIN_ID) || enabledPlugins.includes(CITATION_PLUGIN_CAPABILITY_ID)
}
