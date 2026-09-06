import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import { GMAIL_MANAGER_CAPABILITY_ID, gmailManagerManifest } from './index.ts'

test('Gmail Manager declares a valid, manually activated plugin contract', () => {
  assert.equal(gmailManagerManifest.id, 'scriptor.gmail-manager')
  assert.equal(gmailManagerManifest.capabilityId, GMAIL_MANAGER_CAPABILITY_ID)
  assert.equal(gmailManagerManifest.capabilityId, gmailManagerManifest.id)
  assert.deepEqual(gmailManagerManifest.activation, ['manual'])
  assert.ok(gmailManagerManifest.permissions.some((entry) => entry.permission === 'dangerous' && entry.optional))

  const declaredPermissions = new Set(gmailManagerManifest.permissions.map((entry) => entry.permission))
  const commands = Object.fromEntries(
    (gmailManagerManifest.contributes?.commands ?? []).map((entry) => [entry.commandId, entry.permission]),
  )
  assert.deepEqual(commands, {
    'gmail.connect': 'read',
    'gmail.open': 'read',
    'gmail.import': 'write-approved',
    'gmail.modify': 'dangerous',
    'gmail.send': 'dangerous',
  })
  for (const permission of Object.values(commands)) {
    assert.equal(declaredPermissions.has(permission), true, `command uses undeclared permission ${permission}`)
  }
})

test('Gmail Manager is advertised now that its command UI is composed', () => {
  const root = path.resolve(import.meta.dirname, '../../../..')
  const catalog = JSON.parse(
    fs.readFileSync(path.join(root, 'packages/plugin-api/catalog.json'), 'utf8'),
  )
  assert.equal(catalog.some((entry: { id?: string }) => entry.id === gmailManagerManifest.id), true)
  assert.ok(fs.existsSync(path.join(root, 'src/components/GmailManagerPanel.tsx')))
})

test('every native Gmail command enforces the active-vault plugin capability', () => {
  const root = path.resolve(import.meta.dirname, '../../../..')
  const source = fs.readFileSync(
    path.join(root, 'apps/desktop/src-tauri/src/commands/google_calendar.rs'),
    'utf8',
  )
  const commands = [
    'google_gmail_start_auth',
    'google_gmail_disconnect',
    'google_gmail_list_messages',
    'google_gmail_get_message',
    'google_gmail_modify_message',
    'google_gmail_trash_message',
    'google_gmail_send_message',
  ]

  for (const command of commands) {
    const start = source.indexOf(`pub fn ${command}(`)
    assert.notEqual(start, -1, `missing native command ${command}`)
    const nextCommand = source.indexOf('#[tauri::command]', start + 1)
    const body = source.slice(start, nextCommand === -1 ? source.length : nextCommand)
    assert.match(body, /require_gmail_capability\(&state\)\?;/, `${command} bypasses plugin state`)
  }
})

test('runtime registry synchronizes first-party capability state through the native bridge', () => {
  const root = path.resolve(import.meta.dirname, '../../../..')
  const runtime = fs.readFileSync(path.join(root, 'src/hooks/usePluginRegistry.ts'), 'utf8')
  const bridge = fs.readFileSync(path.join(root, 'src/bridge/plugin.ts'), 'utf8')

  assert.match(runtime, /setPluginCapabilityEnabled\(capabilityId, enabled\)/)
  assert.match(runtime, /loadPluginState\(\)/)
  assert.match(runtime, /await setPluginCapabilityEnabled\(plugin\.manifest\.capabilityId, false\)/)
  assert.match(bridge, /invoke\('plugin_state_set_enabled'/)
})
