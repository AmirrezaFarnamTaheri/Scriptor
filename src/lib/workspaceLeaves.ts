export type WorkspaceLeafReference = { kind: 'note' | 'source'; path: string } | { kind: 'feature' | 'plugin'; id: string }
export type WorkspaceLeafGroup = 'primary' | 'secondary'
export interface WorkspaceLeaf { id: string; reference: WorkspaceLeafReference; group: WorkspaceLeafGroup }
export interface WorkspaceLayout { version: 1; leaves: WorkspaceLeaf[]; activeId: string | null; activeByGroup: Record<WorkspaceLeafGroup, string | null> }
export interface WorkspaceLeafTransition { action: 'open' | 'select' | 'close' | 'move' | 'reorder'; from: WorkspaceLeaf | null; to: WorkspaceLeaf | null; previous: WorkspaceLayout; next: WorkspaceLayout }
export type WorkspaceLeafReason = 'limit' | 'unavailable' | 'guard' | 'changed'
export const MAX_WORKSPACE_LEAVES = 24
export function emptyWorkspaceLayout(): WorkspaceLayout { return { version: 1, leaves: [], activeId: null, activeByGroup: {primary: null, secondary: null} } }
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const exact = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
export function isWorkspaceLeafReference(value: unknown): value is WorkspaceLeafReference {
  if (!record(value)) return false
  if (value.kind === 'note' || value.kind === 'source') {
    return exact(value, ['kind', 'path']) && typeof value.path === 'string' && value.path.length > 0 && value.path.length <= 2048 && !/[\\\x00-\x1f\x7f:]/.test(value.path) && !value.path.startsWith('/') && value.path.split('/').every(part => part !== '' && part !== '.' && part !== '..')
  }
  if (!exact(value, ['kind','id']) || typeof value.id !== 'string') return false
  if (value.kind === 'plugin') {
    const parts = value.id.split(':')
    return parts.length === 2 && parts.every(part => /^[a-z0-9][a-z0-9.-]{0,63}$/.test(part) && !part.includes('..'))
  }
  return value.kind === 'feature' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(value.id)
}
export function workspaceLeafId(reference: WorkspaceLeafReference): string { return `${reference.kind}:${'path' in reference ? reference.path : reference.id}` }
export function getWorkspaceActiveLeaf(state: WorkspaceLayout, group?: WorkspaceLeafGroup): WorkspaceLeaf | null {
  return state.leaves.find(leaf => leaf.id === (group ? state.activeByGroup[group] : state.activeId)) ?? null
}
export function prepareWorkspaceLeafTransition(action: WorkspaceLeafTransition['action'], previous: WorkspaceLayout, reduced: WorkspaceLayout, available: (reference: WorkspaceLeafReference) => boolean, targetId?: string): WorkspaceLeafTransition {
  const next = parseWorkspaceLayout(serializeWorkspaceLayout(reduced), available)
  return {action, from: targetId ? previous.leaves.find(leaf => leaf.id === targetId) ?? null : getWorkspaceActiveLeaf(previous), to: getWorkspaceActiveLeaf(next), previous, next}
}
export function workspaceLeafTransitionRefusal(request: WorkspaceLeafTransition, reduced: WorkspaceLayout): WorkspaceLeafReason | null {
  if (reduced === request.previous) return request.action === 'open' && request.previous.leaves.length >= MAX_WORKSPACE_LEAVES ? 'limit' : 'unavailable'
  if ((request.action === 'open' || request.action === 'select') && request.next.activeId !== reduced.activeId) return 'unavailable'
  return null
}
export function parseWorkspaceLayout(raw: string | null, available: (reference: WorkspaceLeafReference) => boolean = () => true): WorkspaceLayout {
  if (!raw || raw.length > 65536) return emptyWorkspaceLayout()
  try {
    const value: unknown = JSON.parse(raw)
    if (!record(value) || !exact(value, ['version', 'leaves', 'activeId', 'activeByGroup']) || value.version !== 1 || !Array.isArray(value.leaves) || value.leaves.length > MAX_WORKSPACE_LEAVES || (value.activeId !== null && typeof value.activeId !== 'string') || !record(value.activeByGroup) || !exact(value.activeByGroup,['primary','secondary']) || ![value.activeByGroup.primary,value.activeByGroup.secondary].every(id => id === null || typeof id === 'string')) return emptyWorkspaceLayout()
    const leaves: WorkspaceLeaf[] = []
    const seen = new Set<string>()
    for (const entry of value.leaves) {
      if (!record(entry) || !exact(entry, ['id', 'reference', 'group']) || !isWorkspaceLeafReference(entry.reference) || entry.id !== workspaceLeafId(entry.reference) || (entry.group !== 'primary' && entry.group !== 'secondary') || (entry.reference.kind === 'feature' && entry.reference.id === 'editor' && entry.group === 'secondary') || seen.has(entry.id)) return emptyWorkspaceLayout()
      seen.add(entry.id)
      if (available(entry.reference)) leaves.push({id: entry.id, reference: entry.reference, group: entry.group})
    }
    const storedGroups = value.activeByGroup
    const selected = (group: WorkspaceLeafGroup) => leaves.find(leaf => leaf.group === group && leaf.id === storedGroups[group])?.id ?? leaves.find(leaf => leaf.group === group)?.id ?? null
    const activeId = leaves.some(leaf => leaf.id === value.activeId) ? value.activeId as string : leaves[0]?.id ?? null
    const activeByGroup = {primary:selected('primary'),secondary:selected('secondary')}
    const active = leaves.find(leaf => leaf.id === activeId)
    if (active) activeByGroup[active.group] = active.id
    return {version: 1, leaves, activeId, activeByGroup}
  } catch { return emptyWorkspaceLayout() }
}
export function serializeWorkspaceLayout(state: WorkspaceLayout): string { return JSON.stringify(state) }
export function workspaceLayoutStorageKey(vaultId: string): string { return `scriptor:workspace-leaves:v1:${encodeURIComponent(vaultId)}` }
export function openWorkspaceLeaf(state: WorkspaceLayout, reference: WorkspaceLeafReference, group: WorkspaceLeafGroup = 'primary'): WorkspaceLayout {
  if (!isWorkspaceLeafReference(reference) || (group !== 'primary' && group !== 'secondary') || (reference.kind === 'feature' && reference.id === 'editor' && group === 'secondary')) return state
  const id = workspaceLeafId(reference)
  if (state.leaves.some(leaf => leaf.id === id)) return selectWorkspaceLeaf(state,id)
  if (state.leaves.length >= MAX_WORKSPACE_LEAVES) return state
  return {...state, leaves: [...state.leaves, {id, reference, group}], activeId: id, activeByGroup:{...state.activeByGroup,[group]:id}}
}
export function selectWorkspaceLeaf(state: WorkspaceLayout, id: string): WorkspaceLayout { const leaf = state.leaves.find(leaf => leaf.id === id); return leaf ? {...state, activeId:id, activeByGroup:{...state.activeByGroup,[leaf.group]:id}} : state }
export function closeWorkspaceLeaf(state: WorkspaceLayout, id: string): WorkspaceLayout {
  const index = state.leaves.findIndex(leaf => leaf.id === id)
  if (index < 0) return state
  const leaves = state.leaves.filter(leaf => leaf.id !== id)
  const group = state.leaves[index].group
  const next = {...state, leaves, activeId: state.activeId === id ? leaves[Math.min(index, leaves.length - 1)]?.id ?? null : state.activeId, activeByGroup:{...state.activeByGroup,[group]:state.activeByGroup[group] === id ? leaves.find(leaf => leaf.group === group)?.id ?? null : state.activeByGroup[group]}}
  return next.activeId ? selectWorkspaceLeaf(next,next.activeId) : next
}
export function moveWorkspaceLeaf(state: WorkspaceLayout, id: string, group: WorkspaceLeafGroup): WorkspaceLayout {
  const leaf = state.leaves.find(leaf => leaf.id === id)
  if (!leaf || leaf.group === group || (group !== 'primary' && group !== 'secondary') || (leaf.reference.kind === 'feature' && leaf.reference.id === 'editor' && group === 'secondary')) return state
  const leaves = state.leaves.map(candidate => candidate.id === id ? {...candidate, group} : candidate)
  return {...state, leaves, activeId:id, activeByGroup:{...state.activeByGroup,[group]:id,[leaf.group]:state.activeByGroup[leaf.group] === id ? leaves.find(candidate => candidate.group === leaf.group)?.id ?? null : state.activeByGroup[leaf.group]}}
}
export function reorderWorkspaceLeaf(state: WorkspaceLayout, id: string, direction: -1 | 1): WorkspaceLayout {
  if (direction !== -1 && direction !== 1) return state
  const index = state.leaves.findIndex(leaf => leaf.id === id)
  if (index < 0) return state
  const leaf = state.leaves[index]
  const siblings = state.leaves.map((candidate, position) => candidate.group === leaf.group ? position : -1).filter(position => position >= 0)
  const target = siblings[siblings.indexOf(index) + direction]
  if (target === undefined) return state
  const leaves = [...state.leaves]
  ;[leaves[index], leaves[target]] = [leaves[target], leaves[index]]
  return {...state, leaves}
}
