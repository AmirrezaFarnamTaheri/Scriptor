import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

import { gmailManagerManifest } from './index.ts'

test('Gmail Manager declares a valid, manually activated plugin contract', () => {
  assert.equal(gmailManagerManifest.id, 'scriptor.gmail-manager')
  assert.deepEqual(gmailManagerManifest.activation, ['manual'])
  assert.ok(gmailManagerManifest.permissions.some((entry) => entry.permission === 'dangerous' && entry.optional))
  assert.ok(gmailManagerManifest.contributes?.commands?.some((entry) => entry.commandId === 'gmail.send'))
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
