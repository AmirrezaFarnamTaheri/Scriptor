import { useCallback, useEffect, useRef, useState } from 'react'
import { collaborationPollRead, collaborationPollStart, collaborationPollStop } from '../bridge/commands/collaboration'
import type { CollaborationTransport } from '../bridge/commands/collaboration'
import { MAX_POLL_REQUESTS, pollingDelay } from '../lib/collaborationPolling'

type Listing = Awaited<ReturnType<typeof collaborationPollRead>>
/** A visible panel owns a finite native lease; stopping invalidates late results. */
export function useCollaborationPolling(folderId: string, vaultId: string | null, path: string | null, transport: CollaborationTransport, onListing: (listing: Listing) => void) {
  const [active, setActive] = useState(false)
  const [starting, setStarting] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const generation = useRef(0)
  const pending = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lease = useRef<{ id: string; vaultId: string } | null>(null)
  const receive = useRef(onListing)
  useEffect(() => { receive.current = onListing }, [onListing])
  const release = useCallback(() => {
    const current = ++generation.current
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    const previous = lease.current
    lease.current = null
    if (previous) void collaborationPollStop(previous.id, previous.vaultId).catch(reason => { if (current === generation.current) setError(`Polling stopped locally, but native cleanup failed: ${String(reason)}`) })
  }, [])
  const stop = useCallback(() => {
    release(); setActive(false); setStarting(pending.current)
    setStatus(pending.current ? 'Automatic checks were cancelled. Waiting for the submitted authorization to finish before another session can start.' : 'Automatic checks stopped.')
  }, [release])
  useEffect(() => {
    release()
    const current = generation.current
    void Promise.resolve().then(() => { if (current === generation.current) { setActive(false); setStarting(pending.current) } })
    const hidden = () => { if (document.hidden) { stop(); setStatus('Polling stopped while this window was hidden. Start a new session explicitly.') } }
    document.addEventListener('visibilitychange', hidden)
    return () => { release(); document.removeEventListener('visibilitychange', hidden) }
  }, [folderId, vaultId, path, transport, stop, release])
  const start = async () => {
    if (!folderId || !vaultId || pending.current || lease.current) return
    pending.current = true
    const current = ++generation.current
    setStarting(true); setError('')
    try {
      const session = await collaborationPollStart(folderId, vaultId, transport)
      if (current !== generation.current) { await collaborationPollStop(session.lease_id, vaultId); return }
      lease.current = { id: session.lease_id, vaultId }
      setActive(true); setStarting(false)
      let requests = 0, failures = 0
      const tick = async () => {
        if (current !== generation.current) return
        if (requests >= MAX_POLL_REQUESTS || Date.now() >= Date.parse(session.expires_at)) { stop(); setStatus('Polling session ended. Start another session explicitly to check again.'); return }
        requests++
        try {
          const listing = await collaborationPollRead(session.lease_id, vaultId)
          if (current !== generation.current) return
          failures = 0; setError(''); receive.current(listing)
          setStatus(`Checked shared revisions. ${MAX_POLL_REQUESTS - requests} checks remain; session ends at ${new Date(session.expires_at).toLocaleTimeString()}. Incoming changes require review and explicit apply.`)
        } catch (reason) {
          if (current !== generation.current) return
          failures++; setError(`Shared revisions could not be checked: ${String(reason)}`)
          if (failures >= 3) { stop(); setStatus('Polling stopped after three consecutive failures. Check the connection and start a new session explicitly.'); return }
          setStatus(`Check failed; next attempt in ${pollingDelay(failures) / 1000} seconds.`)
        }
        if (current === generation.current) timer.current = setTimeout(() => { void tick() }, pollingDelay(failures))
      }
      void tick()
    } catch (reason) { if (current === generation.current) { setError(String(reason)); setStarting(false) } }
    finally { pending.current = false; setStarting(false) }
  }
  return { active, starting, status, error, start, stop }
}
