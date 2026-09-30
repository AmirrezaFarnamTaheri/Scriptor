import { useEffect, useMemo, useRef, useState } from 'react'
import { authorizeWorkspaceAction, authorizeWorkspaceView, parsePluginWorkspace, type PluginRuntimePolicy, type PluginWorkspaceDefinition, type PluginWorkspaceRoute } from '@scriptor/plugin-api'
import './plugin-workspace.css'

export interface PluginWorkspaceLabels {
  unavailable: string
  retry: string
  empty: string
  working: string
  complete: string
}
const defaultWorkspaceLabels: PluginWorkspaceLabels = { unavailable: 'Workspace unavailable', retry: 'Retry', empty: 'This workspace has no content yet.', working: 'Working…', complete: 'Action completed.' }
export interface PluginWorkspaceHostProps {
  definition: unknown
  policy: PluginRuntimePolicy
  vaultId: string | null
  onNavigate: (route: PluginWorkspaceRoute) => void | Promise<void>
  onCommand: (commandId: string) => Promise<void>
  labels?: PluginWorkspaceLabels
}

export function PluginWorkspaceHost(props: PluginWorkspaceHostProps) {
  const result = useMemo(() => {
    try {
      const view = parsePluginWorkspace(props.definition)
      authorizeWorkspaceView(view, props.policy, props.vaultId)
      return { view }
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) }
    }
  }, [props.definition, props.policy, props.vaultId])
  const labels = props.labels ?? defaultWorkspaceLabels
  if (!result.view) return <section className="plugin-workspace" role="alert"><h2>{labels.unavailable}</h2><p>{result.error}</p></section>
  return <WorkspaceContent key={`${result.view.pluginId}:${result.view.id}:${props.vaultId}`} {...props} view={result.view} labels={labels} />
}

function WorkspaceContent({ view, policy, vaultId, onNavigate, onCommand, labels }: PluginWorkspaceHostProps & { view: PluginWorkspaceDefinition; labels: PluginWorkspaceLabels }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [completed, setCompleted] = useState(false)
  const lastAction = useRef<(() => Promise<void>) | null>(null)
  const busy = useRef(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  async function perform(operation: () => Promise<void>) {
    if (busy.current) return
    busy.current = true
    lastAction.current = operation
    setPending(true)
    setError('')
    setCompleted(false)
    try {
      await operation()
      if (mounted.current) setCompleted(true)
    } catch (error) {
      if (mounted.current) setError(error instanceof Error ? error.message : String(error))
    } finally {
      busy.current = false
      if (mounted.current) setPending(false)
    }
  }
  async function navigate(route: PluginWorkspaceRoute) {
    authorizeWorkspaceView(view, policy, vaultId)
    await onNavigate(route)
  }
  async function invoke(actionId: string) {
    const action = authorizeWorkspaceAction(view, actionId, policy, vaultId)
    if (action.kind === 'navigate') await onNavigate(action.route)
    else await onCommand(action.commandId)
  }
  return <section className="plugin-workspace" aria-label={view.title} aria-busy={pending}>
    <header><h2>{view.title}</h2><p>{view.description}</p></header>
    {!view.sections.length && <p>{labels.empty}</p>}
    {view.sections.map(section => <div key={section.id} className="plugin-workspace-section">
      {section.kind === 'text' && <p className="plugin-workspace-text">{section.text}</p>}
      {section.kind === 'metrics' && <dl>{section.items.map((item, index) => <div key={index}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>}
      {section.kind === 'list' && <ul>{section.items.map((item, index) => <li key={index}>
        {item.route ? <button type="button" disabled={pending} onClick={() => { void perform(() => navigate(item.route!)) }}>{item.label}</button> : <span>{item.label}</span>}
        {item.description && <p>{item.description}</p>}
      </li>)}</ul>}
    </div>)}
    <div className="plugin-workspace-actions">{view.actions.map(action => <button type="button" key={action.id} disabled={pending} onClick={() => { void perform(() => invoke(action.id)) }}>{action.label}</button>)}</div>
    <p role="status" aria-live="polite">{pending ? labels.working : completed ? labels.complete : ''}</p>
    {error && <div role="alert"><p>{error}</p><button type="button" disabled={pending} onClick={() => { if (lastAction.current) void perform(lastAction.current) }}>{labels.retry}</button></div>}
  </section>
}
