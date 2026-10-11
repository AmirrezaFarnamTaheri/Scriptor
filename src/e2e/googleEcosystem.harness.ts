import { DEFAULT_VAULT_CONFIG } from '../lib/settingsDefaults'

/** Explicit browser-only fixture. It owns no real account or provider connection. */
export function createGoogleEcosystemHarness() {
  const active = sessionStorage.getItem('e2e:google-ecosystem') === '1'
  const folders = [{ id: 'shared-folder', name: 'Research shared folder' }, { id: 'archive-folder', name: 'Archive folder' }]
  const calendars = [
    { id: 'primary@example.com', summary: 'My writable calendar', accessRole: 'owner', primary: true, writable: true },
    { id: 'reader@example.com', summary: 'Shared read-only calendar', accessRole: 'reader', primary: false, writable: false },
    { id: 'busy@example.com', summary: 'Availability only', accessRole: 'freeBusyReader', primary: false, writable: false },
  ]
  const config = () => JSON.parse(sessionStorage.getItem('e2e:google-config') ?? JSON.stringify({
    ...DEFAULT_VAULT_CONFIG,
    calendar_sync: { ...DEFAULT_VAULT_CONFIG.calendar_sync, enabled: true, google_client_id: 'desktop.apps.googleusercontent.com', google_calendar_id: 'primary', google_task_list_id: '@default', google_drive_folder_id: 'shared-folder', google_drive_transport: 'drive_json', push_vault_tasks: false },
  })) as unknown
  return (cmd: string, payload: unknown): { handled: boolean; value?: unknown } => {
    if (!active) return { handled: false }
    const body = (payload ?? {}) as Record<string, unknown>
    const google = /^(google_calendar_|google_planner_|collaboration_|google_gmail_)/.test(cmd)
    const authorization = cmd === 'authorize_sensitive_operation' && /^(google_|keychain_delete)/.test(String(body.operation))
    const vault = ['vault_load_config', 'vault_save_config_cmd', 'vault_read_note', 'vault_save_note'].includes(cmd)
    if (!google && !authorization && !vault) return { handled: false }
    const calls = JSON.parse(sessionStorage.getItem('e2e:google-ecosystem-calls') ?? '[]') as unknown[]
    calls.push({ cmd, payload: body })
    sessionStorage.setItem('e2e:google-ecosystem-calls', JSON.stringify(calls))
    const reply = (value: unknown) => ({ handled: true, value })
    const requireAccount = (service: 'drive' | 'calendar') => {
      if (sessionStorage.getItem(`e2e:google-${service}-connected`) === '0') throw new Error(`GOOGLE_AUTH_REQUIRED: ${service} is not connected`)
    }
    const delayed = (value: unknown, kind: string) => sessionStorage.getItem(`e2e:google-delay-${kind}`) !== '1' ? reply(value)
      : reply(new Promise(resolve => window.setTimeout(() => { sessionStorage.setItem(`e2e:google-late-${kind}`, '1'); resolve(value) }, 1500)))
    if (authorization) {
      if (sessionStorage.getItem('e2e:google-cancel-operation') === body.operation) throw new Error('Authorization cancelled')
      return { handled: false }
    }
    if (cmd === 'vault_load_config') return reply(config())
    if (cmd === 'vault_save_config_cmd') {
      if (body.expectedVaultId !== 'screenshot-vault') throw new Error('Vault changed before saving Google setup')
      if (sessionStorage.getItem('e2e:google-config-save-error') === '1') throw new Error('Google setup could not be persisted')
      sessionStorage.setItem('e2e:google-config', JSON.stringify(body.config))
      return reply(null)
    }
    if (cmd === 'vault_save_note' && sessionStorage.getItem('e2e:google-stale-note') === '1') throw new Error('content hash mismatch: note changed since preview')
    if (cmd === 'vault_save_note' || cmd === 'vault_read_note') return { handled: false }
    if (cmd.startsWith('google_gmail_')) return { handled: false }
    if (cmd === 'collaboration_get_account') return delayed(sessionStorage.getItem('e2e:google-drive-connected') === '0' ? null : 'drive@example.com', 'account')
    if (cmd === 'collaboration_connect') { sessionStorage.setItem('e2e:google-drive-connected', '1'); return reply('drive@example.com') }
    if (cmd === 'collaboration_disconnect') { sessionStorage.setItem('e2e:google-drive-connected', '0'); return reply(null) }
    if (cmd === 'collaboration_read' || cmd === 'collaboration_write') {
      requireAccount('drive')
      if (body.expectedVaultId !== 'screenshot-vault') throw new Error('Vault changed before a Drive transfer')
      const request = body.request as Record<string, unknown>
      if (request.kind === 'generate_revision_id') return reply({ id: 'drive-generated-id-1' })
      if (request.kind === 'list_folders') return delayed({ files: request.page_token ? [folders[0], folders[1]] : [folders[0]], ...(!request.page_token ? { nextPageToken: 'folders-2' } : {}) }, 'folders')
      if (request.kind === 'create_folder') {
        const created = { id: 'created-folder', name: String(request.name) }; folders.push(created); return reply(created)
      }
      if (request.kind === 'list_docs') return reply({ files: [{ id: 'shared-doc', name: 'Shared Google document' }] })
      if (request.kind === 'read_docs') return delayed({ title: 'Shared Google document', body: { content: [{ paragraph: { elements: [{ textRun: { content: 'Remote translated text\n' } }] } }] } }, 'docs')
      if (request.kind === 'append_docs') return reply({ id: 'new-doc', name: String(request.title) })
      if (request.kind === 'list') {
        const loop = sessionStorage.getItem('e2e:google-revision-loop') === '1'
        return reply({ files: request.page_token ? [{ id: 'revision-1', name: 'Shared revision one' }, { id: 'revision-2', name: 'Shared revision two' }] : [{ id: 'revision-1', name: 'Shared revision one' }], ...(!request.page_token || loop ? { nextPageToken: 'revisions-2' } : {}) })
      }
      if (request.kind === 'read' || request.kind === 'read_docs_record') return reply({ schema: 'scriptor.collaboration.v1', id: 'event-1', document: 'Research Plan.md', peer_id: 'remote-peer', base_markdown: '# Base\n', markdown: '# Remote\n', created_at: '2026-10-09T00:00:00Z' })
      if (request.kind === 'append' || request.kind === 'append_docs_record') return reply(null)
    }
    if (cmd === 'google_calendar_start_auth') { sessionStorage.setItem('e2e:google-calendar-connected', '1'); return reply('calendar@example.com') }
    if (cmd === 'google_calendar_disconnect') { sessionStorage.setItem('e2e:google-calendar-connected', '0'); return reply(null) }
    if (cmd.startsWith('google_calendar_') || cmd.startsWith('google_planner_')) requireAccount('calendar')
    if (cmd === 'google_calendar_get_authed_email') return reply('calendar@example.com')
    if (cmd === 'google_calendar_list_calendars') return reply(calendars)
    if (cmd === 'google_calendar_list_task_lists') return reply([{ id: '@default', title: 'Default tasks' }, { id: 'research-tasks', title: 'Research task list' }])
    if (cmd === 'google_calendar_list_tasks') return reply([])
    if (cmd === 'google_calendar_list_events') return reply([{ id: 'remote-event', etag: 'fixture-etag', summary: 'Remote meeting', description: null, start: '2026-10-09T09:00:00Z', end: '2026-10-09T10:00:00Z', allDay: false, location: null, meetingLink: null, calendarId: String(body.calendarId), status: 'confirmed', attendees: [], reminders: [], linkedNotePath: null }])
    if (cmd === 'google_planner_write_event' || cmd === 'google_planner_write_task') return reply({ id: (body.request as Record<string, unknown>).eventId ?? 'fixture-task', etag: 'updated-etag' })
    if (cmd === 'google_calendar_create_task') return reply({ id: 'created-task', title: body.title, notes: body.notes, due: body.due, status: 'needsAction', etag: 'task-etag', completed: null, subtasks: [], fromVault: true, sourcePath: null })
    return { handled: false }
  }
}
