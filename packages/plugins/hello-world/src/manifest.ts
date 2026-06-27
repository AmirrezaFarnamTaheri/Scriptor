import type { PluginManifest } from '@scriptor/core/contracts/plugin'

export const helloWorldManifest: PluginManifest = {
  id: 'hello-world',
  name: 'Hello World',
  version: '0.1.0',
  publisher: 'Example',
  description: 'Minimal example plugin that registers a greeting command.',
  activation: ['manual'],
  capabilities: ['command'],
  permissions: [{ permission: 'read', reason: 'Read note metadata for the greeting.' }],
  contributes: {
    commands: [
      {
        commandId: 'hello.greet',
        label: 'Hello World: Greet',
        category: 'Tools',
        permission: 'read',
      },
    ],
  },
}
