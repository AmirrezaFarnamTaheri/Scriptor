/** Gmail-only opt-in provider fixture. No real account or network calls. */
export function createGoogleGmailHarness() {
  const active = sessionStorage.getItem('e2e:google-gmail') === '1'
  const removed = new Set<string>()
  const messages = [
    { id: 'a1', threadId: 'aa1', subject: 'Research meeting', from: 'Colleague <colleague@example.com>', date: '2026-10-08T09:00:00Z', snippet: 'Meeting agenda' },
    { id: 'a2', threadId: 'aa2', subject: 'Project update', from: 'Team <team@example.com>', date: '2026-10-08T08:00:00Z', snippet: 'Progress report' },
    { id: 'b1', threadId: 'bb1', subject: 'Older correspondence', from: 'Archive <archive@example.com>', date: '2026-10-07T10:00:00Z', snippet: 'Earlier discussion' },
    { id: 'c1', threadId: 'cc1', subject: 'New search result', from: 'New sender <new@example.com>', date: '2026-10-08T10:00:00Z', snippet: 'Search-specific result' },
  ]
  return (cmd: string, payload: unknown): { handled: boolean; value?: unknown } => {
    if (!active) return { handled: false }
    const body = (payload ?? {}) as Record<string, unknown>
    const isAuthorization = cmd === 'authorize_sensitive_operation' && String(body.operation).startsWith('google_gmail_')
    const isOtherGoogle = /^(google_calendar_|google_task_|collaboration_)/.test(cmd)
      || (cmd === 'authorize_sensitive_operation' && String(body.operation).startsWith('google_'))
    if (!cmd.startsWith('google_gmail_') && !isAuthorization && !isOtherGoogle && cmd !== 'vault_save_note') return { handled: false }
    const calls = JSON.parse(sessionStorage.getItem('e2e:gmail-calls') ?? '[]') as unknown[]
    calls.push({ cmd, payload: body })
    sessionStorage.setItem('e2e:gmail-calls', JSON.stringify(calls))
    if (isOtherGoogle && !isAuthorization) return { handled: false }
    if (isAuthorization && sessionStorage.getItem('e2e:gmail-cancel-approval') === '1') throw new Error('Authorization cancelled')
    if (isAuthorization || cmd === 'vault_save_note') return { handled: false }
    const reply = (value: unknown) => ({ handled: true, value })
    const authed = () => {
      if (sessionStorage.getItem('e2e:gmail-connected') === '0') throw new Error('GOOGLE_AUTH_REQUIRED: Gmail is not connected')
    }
    const delayed = (value: unknown, kind: 'list' | 'detail') => {
      if (sessionStorage.getItem(`e2e:gmail-delay-${kind}`) !== '1') return reply(value)
      return reply(new Promise(resolve => window.setTimeout(() => {
        sessionStorage.setItem(`e2e:gmail-late-${kind}-completed`, '1')
        resolve(value)
      }, 1500)))
    }
    switch (cmd) {
      case 'google_gmail_get_authed_email': authed(); return reply('gmail@example.com')
      case 'google_gmail_start_auth':
        if (sessionStorage.getItem('e2e:gmail-auth-cancel') === '1') throw new Error('Authorization cancelled')
        sessionStorage.setItem('e2e:gmail-connected', '1')
        return reply('gmail@example.com')
      case 'google_gmail_disconnect': sessionStorage.setItem('e2e:gmail-connected', '0'); return reply(null)
      case 'google_gmail_list_messages_page': {
        authed()
        if (sessionStorage.getItem('e2e:gmail-list-error') === '1') throw new Error('Gmail temporarily unavailable')
        if (sessionStorage.getItem('e2e:gmail-immediate-pagination-loop') === '1') {
          return reply({ messages: [messages[0]], nextPageToken: 'page-2' })
        }
        if (sessionStorage.getItem('e2e:gmail-pagination-loop') === '1') {
          return reply({ messages: [messages[0]], nextPageToken: body.pageToken === 'page-2' ? 'page-3' : 'page-2' })
        }
        const query = String(body.query ?? '')
        const rows = query === 'is:unread' ? [] : query === 'from:new@example.com' ? [messages[3]]
          : body.pageToken ? [messages[1], messages[2]] : messages.slice(0, 2)
        return delayed({ messages: rows.filter(item => !removed.has(item.id)), nextPageToken: query === 'in:inbox' && !body.pageToken ? 'page-2' : null }, 'list')
      }
      case 'google_gmail_get_message': {
        authed()
        const item = messages.find(message => message.id === body.id)
        if (!item) throw new Error('Unknown fixture Gmail message')
        return delayed({ ...item, plainText: '<script>alert(1)</script>\n![remote image](https://example.com/pixel)\nPlain message text.' }, 'detail')
      }
      case 'google_gmail_modify_message':
      case 'google_gmail_trash_message': authed(); removed.add(String(body.id)); return reply(null)
      case 'google_gmail_send_message':
        authed()
        if (sessionStorage.getItem('e2e:gmail-send-error') === '1') throw new Error('Gmail send failed')
        return reply(null)
      default: return { handled: false }
    }
  }
}
