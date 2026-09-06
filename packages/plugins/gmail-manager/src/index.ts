import type { PluginManifest } from '@scriptor/core/contracts/plugin'

export const GMAIL_MANAGER_PLUGIN_ID = 'scriptor.gmail-manager'
export const GMAIL_MANAGER_CAPABILITY_ID = 'scriptor.gmail-manager'

/**
 * Gmail Manager is a first-party desktop plugin. OAuth, keychain persistence,
 * and every mailbox mutation stay in the native bridge. Generic commands use
 * the same native bridge and permission checks as the panel UI.
 */
export const gmailManagerManifest: PluginManifest = {
  id: GMAIL_MANAGER_PLUGIN_ID,
  name: 'Gmail Manager',
  version: '1.0.0',
  publisher: 'Scriptor',
  description: 'Manage Gmail messages and import selected mail into the current Markdown vault.',
  activation: ['manual'],
  capabilities: ['command', 'inspector-widget'],
  permissions: [
    { permission: 'read', reason: 'Display connected Gmail message metadata.' },
    { permission: 'write-approved', reason: 'Import a reviewed message into the current vault.' },
    { permission: 'dangerous', reason: 'Archive, relabel, trash, and send Gmail messages after native confirmation.', optional: true },
  ],
  capabilityId: GMAIL_MANAGER_CAPABILITY_ID,
  contributes: {
    commands: [
      { commandId: 'gmail.connect', label: 'Connect Gmail Manager', category: 'Gmail', permission: 'read' },
      { commandId: 'gmail.open', label: 'Open Gmail Manager', category: 'Gmail', permission: 'read' },
      { commandId: 'gmail.import', label: 'Import Gmail message to Markdown', category: 'Gmail', permission: 'write-approved' },
      { commandId: 'gmail.modify', label: 'Modify Gmail message', category: 'Gmail', permission: 'dangerous' },
      { commandId: 'gmail.send', label: 'Send Gmail message', category: 'Gmail', permission: 'dangerous' },
    ],
    inspectorWidgets: [
      { id: 'gmail-manager', label: 'Gmail Manager', placement: 'vault' },
    ],
  },
}
