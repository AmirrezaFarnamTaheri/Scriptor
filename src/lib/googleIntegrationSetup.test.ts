import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { googleResourceOptions, mergeGoogleClientId } from './googleIntegrationSetup.ts'

describe('Google integration setup', () => {
  it('retains explicit aliases and a manually configured resource outside discovery', () => {
    assert.deepEqual(googleResourceOptions('primary', 'Primary', 'shared@example.org', [
      { id: 'work', label: 'Work' }, { id: 'primary', label: 'Duplicate alias' }, { id: 'work', label: 'Duplicate' },
    ]), [
      { id: 'primary', label: 'Primary' }, { id: 'work', label: 'Work' },
      { id: 'shared@example.org', label: 'shared@example.org' },
    ])
  })

  it('updates only the public client ID while preserving provider resources and unrelated config', () => {
    const config = { calendar_sync: { enabled: false, google_calendar_id: 'work', google_drive_folder_id: 'folder', google_client_id: 'old' }, theme: 'dark' }
    const updated = mergeGoogleClientId(config, ' new.apps.googleusercontent.com ')
    assert.equal(updated.calendar_sync.google_client_id, 'new.apps.googleusercontent.com')
    assert.equal(updated.calendar_sync.google_drive_folder_id, 'folder')
    assert.equal(updated.calendar_sync.google_calendar_id, 'work')
    assert.equal(updated.calendar_sync.enabled, false)
    assert.equal(updated.theme, 'dark')
    assert.equal(config.calendar_sync.google_client_id, 'old')
  })
})
