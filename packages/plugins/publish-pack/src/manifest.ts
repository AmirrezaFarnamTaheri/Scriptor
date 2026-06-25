import type { PluginManifest } from '@scriptor/core/contracts/plugin'

export const publishPackManifest: PluginManifest = {
  id: 'scriptor.publish-pack',
  name: 'Publish Pack',
  version: '0.1.0',
  apiVersion: '0.1.0',
  publisher: 'Scriptor',
  description: 'Sample renderer and export profile contributions for publication workflows.',
  activation: ['on-vault-open'],
  capabilities: ['renderer-extension', 'export-profile'],
  permissions: [{ permission: 'read', reason: 'Read note metadata for publication previews' }],
  contributes: {
    rendererExtensions: [
      {
        id: 'publish-callout',
        label: 'Publish callout',
        handles: 'document',
        priority: 10,
      },
    ],
    exportProfiles: [
      {
        id: 'html-publish-pack',
        label: 'Publish HTML',
        format: 'html',
      },
      {
        id: 'wechat-html-publish',
        label: 'WeChat HTML',
        format: 'wechat-html',
      },
    ],
  },
}
