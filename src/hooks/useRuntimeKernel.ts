import { useCallback, useEffect, useRef, useState } from 'react'
import { runtimeKernelRun, runtimeKernelStart, runtimeKernelStatus, runtimeKernelStop } from '../bridge/commands/runtime_kernel'
import type { KernelResult, KernelSession, KernelStatus } from '../components/plugins/runtime-kernel'

export function useRuntimeKernel(vaultId: string) {
  const [session, setSession] = useState<KernelSession | null>(null)
  const [live, setLive] = useState<KernelStatus | null>(null)
  const [result, setResult] = useState<KernelResult | null>(null)
  const [history, setHistory] = useState<Array<{ exitCode: number; durationMs: number; time: string }>>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('No kernel started')
  const sessionRef = useRef<KernelSession | null>(null)
  const busyRef = useRef(false)
  const mounted = useRef(true)
  const epoch = useRef(0)
  const stopping = useRef<Promise<boolean> | null>(null)
  const pending = useRef<Promise<void> | null>(null)
  const stop = useCallback((): Promise<boolean> => {
    if (stopping.current) return stopping.current
    const origin = sessionRef.current
    const nextEpoch = ++epoch.current
    busyRef.current = true
    if (mounted.current) { setBusy(true); setStatus('Stopping kernel…') }
    const operation = (async () => {
      try {
        if (origin) await runtimeKernelStop(origin)
        else if (pending.current) await pending.current
        // A pending startup cancels itself when its epoch no longer matches.
        if (mounted.current && epoch.current === nextEpoch) { setSession(null); setLive(null); setStatus('Kernel stopped. Restarting creates a clean namespace.') }
        sessionRef.current = null
        return true
      } catch (caught) { if (mounted.current) setError(String(caught)); return false }
      finally { if (epoch.current === nextEpoch) { busyRef.current = false; if (mounted.current) setBusy(false) } }
    })()
    stopping.current = operation
    void operation.finally(() => { if (stopping.current === operation) stopping.current = null })
    return operation
  }, [])
  const start = useCallback(async (environment: Record<string, string>) => {
    if (busyRef.current || sessionRef.current) return
    busyRef.current = true; setBusy(true); setError(''); setStatus('Starting Python kernel…')
    const originEpoch = ++epoch.current
    const operation = (async () => {
      try {
        const next = await runtimeKernelStart(vaultId, environment)
        if (!mounted.current || epoch.current !== originEpoch) {
          // Retain ownership until cancellation is confirmed so a failed stop
          // blocks vault switching and the user can retry the same session.
          sessionRef.current = next
          if (mounted.current) setSession(next)
          await runtimeKernelStop(next)
          sessionRef.current = null
          return
        }
        sessionRef.current = next; setSession(next); setResult(null); setLive(null); setStatus('Kernel ready. Variables persist until you stop or restart it.')
      } catch (caught) {
        if (mounted.current) { setError(String(caught)); setStatus(sessionRef.current ? 'Kernel shutdown is pending. Retry Stop kernel.' : 'Kernel could not start') }
        if (epoch.current !== originEpoch) throw caught
      }
      finally { if (epoch.current === originEpoch) { busyRef.current = false; if (mounted.current) setBusy(false) } }
    })()
    pending.current = operation
    try { await operation } catch { /* The stop waiter reports cancellation failure. */ }
    if (pending.current === operation) pending.current = null
  }, [vaultId])
  const run = useCallback(async (code: string) => {
    const origin = sessionRef.current
    if (!origin || busyRef.current) return
    busyRef.current = true; setBusy(true); setError(''); setLive(null); setStatus('Running reviewed cell…')
    const originEpoch = ++epoch.current
    try {
      const next = await runtimeKernelRun(origin, code)
      if (!mounted.current || epoch.current !== originEpoch) return
      setResult(next); setLive(null); setStatus(next.exit_code === 0 ? 'Cell finished. Variables remain available.' : 'Cell failed. Inspect the error; the namespace remains available.')
      setHistory(rows => [{ exitCode: next.exit_code, durationMs: next.duration_ms, time: new Date().toLocaleTimeString() }, ...rows].slice(0, 20))
    } catch (caught) { if (mounted.current && epoch.current === originEpoch) { setError(String(caught)); setStatus('Execution did not finish') } }
    finally { if (epoch.current === originEpoch) { busyRef.current = false; if (mounted.current) setBusy(false) } }
  }, [])
  useEffect(() => {
    mounted.current = true
    const changeVault = (event: Event) => {
      if (!sessionRef.current && !busyRef.current) return
      const detail = (event as CustomEvent<{ waitUntil: (promise: Promise<boolean>) => void }>).detail
      detail?.waitUntil(stop())
    }
    window.addEventListener('scriptor:vault-change-starting', changeVault)
    return () => { window.removeEventListener('scriptor:vault-change-starting', changeVault); mounted.current = false; void stop() }
  }, [stop])
  useEffect(() => {
    if (!session) return
    let disposed = false, polling = false
    const poll = async () => {
      if (polling) return
      polling = true
      try {
        const next = await runtimeKernelStatus(session)
        if (disposed || sessionRef.current?.id !== session.id) return
        setLive(next)
        if (next.status === 'stopped') { sessionRef.current = null; setSession(null); setStatus('Kernel stopped or expired. Start a new session to continue.') }
      } catch (caught) { if (!disposed && sessionRef.current?.id === session.id) setError(String(caught)) }
      finally { polling = false }
    }
    const timer = window.setInterval(() => { void poll() }, 500)
    void poll()
    return () => { disposed = true; window.clearInterval(timer) }
  }, [session])
  return { session, live, result, history, busy, error, status, start, run, stop }
}
