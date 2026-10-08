import { readPlannerBlocks, type PlannerBlock } from './planner.ts'

export interface PlannerGoogleOwner { account: string; calendarId: string }
function accountIdentity(account: string): string {
  if (!account.trim() || account.length > 320 || /[\r\n\u0000]/.test(account)) throw new Error('Confirm the Google account before associating planner records')
  return account.trim().toLowerCase()
}
export function plannerGoogleTaskBaseKey(vaultId: string, account: string | null, taskListId: string): string {
  return `scriptor:planner:google-tasks:v2:${JSON.stringify([vaultId, account === null ? null : accountIdentity(account), taskListId])}`
}
/** Local scheduling survives account changes; provider identities and ancestors do not. */
export function readGoogleOwnedPlannerBlocks(raw: string | null, owner: PlannerGoogleOwner | null): PlannerBlock[] {
  if (!raw || raw.length > 2 * 1024 * 1024) return []
  try {
    const value: unknown = JSON.parse(raw)
    const record = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
    const blocks = readPlannerBlocks(JSON.stringify(Array.isArray(value) ? value : record?.blocks))
    const matches = owner !== null && record?.schema === 'scriptor.planner.blocks.v2' && record.account === accountIdentity(owner.account) && record.calendarId === owner.calendarId
    return matches ? blocks : blocks.map(({ eventId: _eventId, base: _base, ...local }) => { void _eventId; void _base; return local })
  } catch { return [] }
}
export function serializeGoogleOwnedPlannerBlocks(blocks: PlannerBlock[], owner: PlannerGoogleOwner | null): string {
  const local = owner === null ? blocks.map(({ eventId: _eventId, base: _base, ...block }) => { void _eventId; void _base; return block }) : blocks
  return JSON.stringify({ schema: 'scriptor.planner.blocks.v2', account: owner === null ? null : accountIdentity(owner.account), calendarId: owner?.calendarId ?? null, blocks: local })
}
