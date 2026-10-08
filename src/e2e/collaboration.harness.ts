/** Explicit opt-in browser fixture. No provider calls or saved credentials. */
export function createCollaborationHarness() {
  const active = sessionStorage.getItem('e2e:collaboration') === '1'
  let stopped = false
  let polls = 0
  return (cmd: string, payload: unknown): { handled: boolean; value?: unknown } => {
    if (!active || !cmd.startsWith('collaboration_')) return { handled: false }
    const body = (payload ?? {}) as Record<string, unknown>
    const calls = JSON.parse(sessionStorage.getItem('e2e:collaboration-calls') ?? '[]') as unknown[]
    calls.push({ cmd, payload: body })
    sessionStorage.setItem('e2e:collaboration-calls', JSON.stringify(calls))
    const reply = (value: unknown) => ({ handled: true, value })
    const listing = () => ({ files: [{ id: `revision-${++polls}`, name: `Shared revision ${polls}` }] })
    switch (cmd) {
      case 'collaboration_get_account': return reply('collaboration@example.invalid')
      case 'collaboration_poll_start': stopped = false; return reply({ lease_id: 'poll-session', expires_at: new Date(Date.now() + 900_000).toISOString(), remaining_requests: 30 })
      case 'collaboration_poll_stop': stopped = true; return reply(null)
      case 'collaboration_poll_read':
        if (stopped) throw new Error('Polling session ended')
        if (sessionStorage.getItem('e2e:poll-failure') === '1') throw new Error('Drive temporarily unavailable')
        if (sessionStorage.getItem('e2e:poll-delay') === '1') return reply(new Promise(resolve => setTimeout(() => resolve(listing()), 5000)))
        return reply(listing())
      case 'collaboration_read': {
        const request = body.request as Record<string, unknown>
        if (request.kind === 'read_docs') return reply({ title: 'Shared Google document', tabs: [{ documentTab: { body: { content: [{ paragraph: { paragraphStyle: { namedStyleType: 'HEADING_1' }, elements: [{ textRun: { content: 'Translated shared text\n' } }] } }] } } }] })
        if (request.kind === 'list') return reply(listing())
        return reply({ schema: 'scriptor.collaboration.v1', id: 'event-1', document: 'Research Plan.md', peer_id: 'peer-remote', base_markdown: '', markdown: 'Incoming shared content', created_at: '2026-10-02T00:00:00Z' })
      }
      case 'collaboration_write': return reply({ id: 'new-doc', name: 'Research Plan.md — text copy' })
      default: return { handled: false }
    }
  }
}
