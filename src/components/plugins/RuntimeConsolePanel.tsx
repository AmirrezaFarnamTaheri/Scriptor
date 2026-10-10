import { useEffect, useRef, useState } from 'react'
import { codeChunkRun } from '../../bridge/commands'
import { UnifiedPanelShell } from '../chrome/UnifiedPanelShell'
import { parseRuntimeConsoleResult, validateRuntimeConsoleInput, type RuntimeConsoleResult } from './runtime-console'
import { parseRuntimeEnvironment } from './runtime-kernel'
import { useRuntimeKernel } from '../../hooks/useRuntimeKernel'
import { useWorkspaceLeafCloseGuard, useWorkspaceLeafReveal } from '../../context/WorkspaceLeafLifecycle'
import type { VaultSwitchDetail } from '../../lib/vaultSwitchGuard'
import '../../styles/components/runtime-console.css'
import './plugin-workspace.css'

export interface RuntimeConsolePanelProps { vaultId: string; onClose(): void }
export function RuntimeConsolePanel({ vaultId, onClose }: RuntimeConsolePanelProps) {
  const [language, setLanguage] = useState('python')
  const [code, setCode] = useState('print("Hello from Scriptor")')
  const [result, setResult] = useState<RuntimeConsoleResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'fresh' | 'persistent'>('fresh')
  const [environment, setEnvironment] = useState('')
  const [environmentReviewed, setEnvironmentReviewed] = useState(false)
  const kernel = useRuntimeKernel(vaultId)
  const executing = useRef(false)
  const generation = useRef(0)
  const reveal = useWorkspaceLeafReveal()
  useWorkspaceLeafCloseGuard(async () => {
    if (!executing.current) return true
    reveal()
    setError('Wait for this fresh process to finish before closing. It has a 30-second time limit.')
    return false
  })
  useEffect(() => {
    const preventSwitch = (event: Event) => {
      if (executing.current) {
        ;(event as CustomEvent<VaultSwitchDetail>).detail?.waitUntil(async () => {
          if (!executing.current) return true
          reveal()
          return false
        })
      }
    }
    window.addEventListener('scriptor:vault-change-starting', preventSwitch)
    return () => { generation.current += 1; window.removeEventListener('scriptor:vault-change-starting', preventSwitch) }
  }, [reveal])
  async function execute() {
    if (executing.current) return
    executing.current = true; setBusy(true); setError(''); setResult(null)
    const origin = generation.current
    try {
      validateRuntimeConsoleInput(language, code)
      const next = parseRuntimeConsoleResult(await codeChunkRun(language, code))
      if (origin === generation.current) setResult(next)
    } catch (reason) { if (origin === generation.current) setError(reason instanceof Error ? reason.message : String(reason)) }
    finally { executing.current = false; if (origin === generation.current) setBusy(false) }
  }
  const close = async () => {
    if (busy) { setError('Wait for this fresh process to finish before closing. It has a 30-second time limit.'); return }
    if (await kernel.stop()) onClose()
  }
  const switchMode = async (next: 'fresh' | 'persistent') => {
    if (busy || kernel.busy) return
    if (kernel.session && !(await kernel.stop())) return
    setMode(next); setError(''); setResult(null)
  }
  const startKernel = async () => {
    try { const reviewed = parseRuntimeEnvironment(environment); setError(''); await kernel.start(reviewed) }
    catch (reason) { setError(String(reason)) }
  }
  return <UnifiedPanelShell title="Runtime console" ariaLabel="Runtime console" modalAriaLabel="Runtime console" helpTopic="code-chunks" onClose={() => { void close() }} wide>
    <div className="plugin-workspace runtime-console">
      <p>Desktop execution must be enabled. Every start and run asks for native permission. Cells have a 30-second time limit and bounded output.</p>
      <label>Execution mode<select value={mode} disabled={busy || kernel.busy} onChange={event => { void switchMode(event.target.value as 'fresh' | 'persistent') }}><option value="fresh">Fresh process</option><option value="persistent">Persistent Python session</option></select></label>
      {mode === 'fresh' && <><p>Each fresh run starts a new process; variables do not carry over.</p><label>Language<select value={language} disabled={busy} onChange={event => setLanguage(event.target.value)}>
        <option value="python">Python</option><option value="javascript">JavaScript (Node)</option><option value="powershell">PowerShell</option><option value="bash">Shell</option>
      </select></label></>}
      {mode === 'persistent' && <><p>One Python process retains variables between cells for up to 15 minutes. Stop or restart clears its namespace and private artifacts. Network access follows the native execution policy.</p>
        <label>Session environment<textarea className="runtime-environment" rows={3} value={environment} disabled={kernel.busy || Boolean(kernel.session)} placeholder="PROJECT=research" onChange={event => { setEnvironment(event.target.value); setEnvironmentReviewed(false) }} spellCheck={false} dir="ltr" /></label>
        {!kernel.session && <><label><input type="checkbox" checked={environmentReviewed} disabled={kernel.busy} onChange={event => setEnvironmentReviewed(event.target.checked)} /><span>I reviewed the Python session and its environment.</span></label><button type="button" disabled={kernel.busy || !environmentReviewed} onClick={() => { void startKernel() }}>Review permission and start kernel</button></>}
        {kernel.session && <p>Python {kernel.session.python_version} · {kernel.live?.session.remaining_seconds ?? kernel.session.remaining_seconds}s remaining · Interpreter: {kernel.session.executable}</p>}
        <p role="status">{kernel.status}</p>
      </>}
      <label>Code<textarea rows={14} value={code} maxLength={64000} spellCheck={false} disabled={busy || kernel.busy} dir="ltr" onChange={event => setCode(event.target.value)} /></label>
      {mode === 'fresh' ? <button disabled={busy || !code.trim()} onClick={() => void execute()}>{busy ? 'Running…' : 'Review permission and run'}</button> : <>
        <button type="button" disabled={!kernel.session || kernel.busy || !code.trim()} onClick={() => { void kernel.run(code) }}>Review permission and run cell</button>
        <button type="button" disabled={!kernel.session && !kernel.busy} onClick={() => { void kernel.stop() }}>Stop kernel</button>
        <button type="button" disabled={!kernel.session || kernel.busy || !environmentReviewed} onClick={() => { void (async () => { if (await kernel.stop()) await startKernel() })() }}>Restart kernel</button>
      </>}
      {busy && <p role="status">Execution is running. The native broker enforces the time limit.</p>}
      {result && <section aria-label="Execution result"><p role="status">Exit {result.exit_code} · {result.duration_ms} ms</p>
        <h3>Standard output</h3><pre>{result.stdout || '(empty)'}</pre><h3>Standard error</h3><pre>{result.stderr || '(empty)'}</pre>
      </section>}
      {error && <p role="alert">{error}</p>}
      {mode === 'persistent' && kernel.live?.status === 'running' && <section aria-label="Live execution output"><h3>Live output</h3><pre>{kernel.live.stdout || '(waiting for output)'}</pre><pre>{kernel.live.stderr}</pre></section>}
      {mode === 'persistent' && kernel.result && <section aria-label="Persistent execution result"><p role="status">Exit {kernel.result.exit_code} · {kernel.result.duration_ms} ms</p><h3>Standard output</h3><pre>{kernel.result.stdout || '(empty)'}</pre><h3>Standard error</h3><pre>{kernel.result.stderr || '(empty)'}</pre>
        {kernel.session?.id === kernel.result.session_id && <><h3>Current variables</h3><table><thead><tr><th>Name</th><th>Type</th><th>Value</th></tr></thead><tbody>{kernel.result.variables.map(variable => <tr key={variable.name}><td>{variable.name}</td><td>{variable.type}</td><td>{variable.value}</td></tr>)}</tbody></table></>}
        {kernel.result.plots.map((plot, index) => <figure key={index}><img src={`data:image/png;base64,${plot.data_base64}`} alt={plot.caption} /><figcaption>{plot.caption}</figcaption></figure>)}
      </section>}
      {mode === 'persistent' && kernel.history.length > 0 && <details><summary>Cell history ({kernel.history.length})</summary><ol>{kernel.history.map((row, index) => <li key={index}>{row.time} · Exit {row.exitCode} · {row.durationMs} ms</li>)}</ol></details>}
      {mode === 'persistent' && kernel.error && <p role="alert">{kernel.error}</p>}
    </div>
  </UnifiedPanelShell>
}
