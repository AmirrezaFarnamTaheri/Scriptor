import { useMemo, useRef, useState } from 'react'
import { runtimeConsoleWorkspace, type PluginRuntimePolicy } from '@scriptor/plugin-api'
import { codeChunkRun } from '../../bridge/commands'
import { UnifiedPanelShell } from '../chrome/UnifiedPanelShell'
import { PluginWorkspaceHost } from './PluginWorkspaceHost'
import { parseRuntimeConsoleResult, validateRuntimeConsoleInput, type RuntimeConsoleResult } from './runtime-console'

export interface RuntimeConsolePanelProps { vaultId: string; onClose(): void }
export function RuntimeConsolePanel({ vaultId, onClose }: RuntimeConsolePanelProps) {
  const policy = useMemo<PluginRuntimePolicy>(() => ({ pluginId: runtimeConsoleWorkspace.pluginId, enabled: true,
    grantedPermissions: ['read'], allowedVaultIds: [vaultId], networkAccess: 'blocked', allowlistedHosts: [] }), [vaultId])
  const [language, setLanguage] = useState('python')
  const [code, setCode] = useState('print("Hello from Scriptor")')
  const [result, setResult] = useState<RuntimeConsoleResult | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const executing = useRef(false)
  async function execute() {
    if (executing.current) return
    executing.current = true; setBusy(true); setError(''); setResult(null)
    try {
      validateRuntimeConsoleInput(language, code)
      setResult(parseRuntimeConsoleResult(await codeChunkRun(language, code)))
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
    finally { executing.current = false; setBusy(false) }
  }
  return <UnifiedPanelShell title="Runtime console" ariaLabel="Runtime console" helpTopic="code-chunks" onClose={onClose} wide>
    <div className="plugin-workspace">
      <PluginWorkspaceHost definition={runtimeConsoleWorkspace} policy={policy} vaultId={vaultId} onNavigate={onClose} onCommand={async () => { throw new Error('No plugin command is registered in this first-party console') }} />
      <p>Every run asks for native authorization, times out after 30 seconds, and limits captured output to 256 KiB. Each run starts a fresh process. Desktop execution must be enabled.</p>
      <label>Language<select value={language} disabled={busy} onChange={event => setLanguage(event.target.value)}>
        <option value="python">Python</option><option value="javascript">JavaScript (Node)</option><option value="powershell">PowerShell</option><option value="bash">Shell</option>
      </select></label>
      <label>Code<textarea rows={14} value={code} maxLength={64000} spellCheck={false} disabled={busy} onChange={event => setCode(event.target.value)} /></label>
      <button disabled={busy || !code.trim()} onClick={() => void execute()}>{busy ? 'Running…' : 'Review permission and run'}</button>
      {busy && <p role="status">Execution is running. The native broker enforces the time limit.</p>}
      {result && <section aria-label="Execution result"><p role="status">Exit {result.exit_code} · {result.duration_ms} ms</p>
        <h3>Standard output</h3><pre>{result.stdout || '(empty)'}</pre><h3>Standard error</h3><pre>{result.stderr || '(empty)'}</pre>
      </section>}
      {error && <p role="alert">{error}</p>}
    </div>
  </UnifiedPanelShell>
}
