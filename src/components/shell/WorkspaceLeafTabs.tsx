import { useId } from 'react'
import type { KeyboardEvent } from 'react'
import { ArrowLeft, ArrowRight, Columns2, MoreHorizontal, X } from 'lucide-react'
import { getWorkspaceActiveLeaf } from '../../lib/workspaceLeaves'
import { useI18n } from '../../lib/i18n'
import type { WorkspaceLayout, WorkspaceLeafGroup, WorkspaceLeafReference } from '../../lib/workspaceLeaves'
import './workspace-leaf-tabs.css'

export interface WorkspaceLeafTabLabels {
  mainTabs: string; sideTabs: string; actions: (label: string) => string; earlier: string; later: string; toSide: string; toMain: string; close: (label: string) => string
}
const defaultLabels: WorkspaceLeafTabLabels = {mainTabs:'Main workspace tabs',sideTabs:'Side workspace tabs',actions:label => `Actions for ${label}`,earlier:'Move tab earlier',later:'Move tab later',toSide:'Move tab to side workspace',toMain:'Move tab to main workspace',close:label => `Close ${label}`}
const germanLabels: WorkspaceLeafTabLabels = {mainTabs:'Tabs im Hauptbereich',sideTabs:'Tabs im Seitenbereich',actions:label => `Aktionen für ${label}`,earlier:'Tab nach vorne verschieben',later:'Tab nach hinten verschieben',toSide:'Tab in den Seitenbereich verschieben',toMain:'Tab in den Hauptbereich verschieben',close:label => `${label} schließen`}
const persianLabels: WorkspaceLeafTabLabels = {mainTabs:'زبانه‌های فضای اصلی',sideTabs:'زبانه‌های فضای کناری',actions:label => `عملیات ${label}`,earlier:'انتقال زبانه به قبل',later:'انتقال زبانه به بعد',toSide:'انتقال زبانه به فضای کناری',toMain:'انتقال زبانه به فضای اصلی',close:label => `بستن ${label}`}
interface Props {
  state: WorkspaceLayout
  group: WorkspaceLeafGroup
  label: (reference: WorkspaceLeafReference) => string
  onSelect: (id: string) => unknown
  onClose: (id: string) => unknown
  onMove: (id: string, group: WorkspaceLeafGroup) => unknown
  onReorder: (id: string, direction: -1 | 1) => unknown
  panelId?: string
  labels?: WorkspaceLeafTabLabels
  pending?: boolean
}
export function WorkspaceLeafTabs({state, group, label, onSelect, onClose, onMove, onReorder, panelId, labels: suppliedLabels, pending = false}: Props) {
  const {locale} = useI18n()
  const labels = suppliedLabels ?? (locale === 'de' ? germanLabels : locale === 'fa' ? persianLabels : defaultLabels)
  const prefix = useId()
  const leaves = state.leaves.filter(leaf => leaf.group === group)
  const selected = getWorkspaceActiveLeaf(state, group)
  const closeActions = (button: HTMLButtonElement) => {
    const details = button.closest('details')
    details?.removeAttribute('open')
    details?.querySelector('summary')?.focus()
  }
  const navigate = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl'
    let next: number | undefined
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = leaves.length - 1
    if (event.key === 'ArrowRight') next = (index + (rtl ? -1 : 1) + leaves.length) % leaves.length
    if (event.key === 'ArrowLeft') next = (index + (rtl ? 1 : -1) + leaves.length) % leaves.length
    if (next !== undefined) {
      event.preventDefault()
      event.currentTarget.closest('[role="tablist"]')?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
    }
    if (event.key === 'Delete') { event.preventDefault(); void onClose(leaves[index].id) }
  }
  if (leaves.length === 0) return null
  return <div className="workspace-leaf-bar" aria-busy={pending}>
    <div className="workspace-leaf-tabs" role="tablist" aria-label={group === 'primary' ? labels.mainTabs : labels.sideTabs}>
      {leaves.map((leaf, index) => <button key={leaf.id} id={`${prefix}-${index}`} disabled={pending} type="button" role="tab" aria-selected={selected?.id === leaf.id} aria-controls={panelId} tabIndex={selected?.id === leaf.id ? 0 : -1} className="workspace-leaf-tab" title={label(leaf.reference)} onKeyDown={event => navigate(event,index)} onClick={() => { void onSelect(leaf.id) }}>{label(leaf.reference)}</button>)}
    </div>
    {selected && <div className="workspace-leaf-actions" role="group" aria-label={labels.actions(label(selected.reference))}>
      <button type="button" aria-label={labels.earlier} title={labels.earlier} disabled={pending || leaves[0].id === selected.id} onClick={() => { void onReorder(selected.id,-1) }}><ArrowLeft size={16} aria-hidden="true" /></button>
      <button type="button" aria-label={labels.later} title={labels.later} disabled={pending || leaves.at(-1)?.id === selected.id} onClick={() => { void onReorder(selected.id,1) }}><ArrowRight size={16} aria-hidden="true" /></button>
      <button type="button" disabled={pending || (selected.reference.kind === 'feature' && selected.reference.id === 'editor')} aria-label={group === 'primary' ? labels.toSide : labels.toMain} title={group === 'primary' ? labels.toSide : labels.toMain} onClick={() => { void onMove(selected.id,group === 'primary' ? 'secondary' : 'primary') }}><Columns2 size={16} aria-hidden="true" /></button>
      <details className="workspace-leaf-compact-actions" onKeyDown={event => { if (event.key === 'Escape') { event.currentTarget.removeAttribute('open'); event.currentTarget.querySelector('summary')?.focus() } }}>
        <summary aria-label={labels.actions(label(selected.reference))} title={labels.actions(label(selected.reference))} aria-disabled={pending} onClick={event => { if (pending) event.preventDefault() }}><MoreHorizontal size={16} aria-hidden="true" /></summary>
        <div className="workspace-leaf-compact-menu">
          <button type="button" disabled={pending || leaves[0].id === selected.id} onClick={event => { closeActions(event.currentTarget); void onReorder(selected.id,-1) }}>{labels.earlier}</button>
          <button type="button" disabled={pending || leaves.at(-1)?.id === selected.id} onClick={event => { closeActions(event.currentTarget); void onReorder(selected.id,1) }}>{labels.later}</button>
          <button type="button" disabled={pending || (selected.reference.kind === 'feature' && selected.reference.id === 'editor')} onClick={event => { closeActions(event.currentTarget); void onMove(selected.id,group === 'primary' ? 'secondary' : 'primary') }}>{group === 'primary' ? labels.toSide : labels.toMain}</button>
        </div>
      </details>
      <button type="button" disabled={pending} aria-label={labels.close(label(selected.reference))} title={labels.close(label(selected.reference))} onClick={() => { void onClose(selected.id) }}><X size={16} aria-hidden="true" /></button>
    </div>}
  </div>
}
