export interface PlannerTaskValue { title: string; done: boolean; due: string | null }
export interface PlannerEventValue { title: string; start: string; end: string }
export interface PlannerBlock extends PlannerEventValue { taskId: string; eventId?: string; base?: PlannerEventValue }
export type Reconciliation = 'equal' | 'pull' | 'push' | 'conflict'
export function planReconciliation<T>(base: T | null, local: T, remote: T): Reconciliation {
  const key = (value: T | null) => JSON.stringify(value)
  if (key(local) === key(remote)) return 'equal'
  if (base === null) return 'conflict'
  if (key(local) === key(base)) return 'pull'
  if (key(remote) === key(base)) return 'push'
  return 'conflict'
}
export function weekDays(day: string): string[] {
  const date = new Date(`${day}T12:00:00Z`)
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid planner date')
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7)
  return Array.from({length:7}, (_, offset) => {
    const next = new Date(date); next.setUTCDate(date.getUTCDate() + offset)
    return next.toISOString().slice(0,10)
  })
}
/** Rewrite exactly the indexed checkbox line; native CAS rejects intervening disk edits. */
export function rewritePlannerTask(markdown: string, task: {line:number;title:string;status:string;dueAt:string|null}, value: PlannerTaskValue): string {
  if (value.title.length > 2048 || /[\r\n]/.test(value.title) || !value.title.trim()) throw new Error('Task title must be one nonempty line')
  if (value.due && !/^\d{4}-\d{2}-\d{2}$/.test(value.due)) throw new Error('Invalid task due date')
  const lines = markdown.split('\n')
  const original = lines[task.line]
  const parsed = original?.match(/^(\s*(?:[-+*]|\d+[.)])\s+\[)[^\]](\]\s+)(.*?)(\r?)$/)
  if (!parsed) throw new Error('Task source changed; refresh before applying')
  const body = parsed[3]
  const checkbox = original.match(/\[(.)\]/)?.[1]
  const status = ({' ':'open','x':'done','X':'done','/':'in-progress','-':'cancelled','>':'forwarded'} as Record<string,string>)[checkbox ?? '']
  const currentDue = body.match(/\u{1F4C5}\s*(\d{4}-\d{2}-\d{2})|\[due::\s*(\d{4}-\d{2}-\d{2})\s*\]/u)
  if (status !== task.status || (currentDue?.[1] ?? currentDue?.[2] ?? null) !== task.dueAt) throw new Error('Task source changed; refresh before applying')
  // The indexed title omits date/priority fields. Verify the authored title before replacing it.
  const titleOnly = body.replace(/\s*(?:\u{1F4C5}|\u23F3|\u{1F6EB}|\u2705)\s*\d{4}-\d{2}-\d{2}/gu,'').replace(/\s*\[(?:due|scheduled|start|completion|priority|repeat)::[^\]]*\]/g,'').replace(/\s*[\u23EB\u{1F53C}\u{1F53D}\u23EC\u{1F53A}]/gu,'').trim()
  if (titleOnly !== task.title.trim()) throw new Error('Task source changed; refresh before applying')
  const metadata = body.match(/(?:\u{1F4C5}|\u23F3|\u{1F6EB}|\u2705)\s*\d{4}-\d{2}-\d{2}|\[(?:due|scheduled|start|completion|priority|repeat)::[^\]]*\]|[\u23EB\u{1F53C}\u{1F53D}\u23EC\u{1F53A}]/gu) ?? []
  const retained = metadata.filter(field => !/^\u{1F4C5}|^\[due::/u.test(field))
  if (value.due) retained.push(body.includes('[due::') ? `[due:: ${value.due}]` : `\u{1F4C5} ${value.due}`)
  lines[task.line] = `${parsed[1]}${value.done ? 'x' : ' '}${parsed[2]}${value.title}${retained.length ? ` ${retained.join(' ')}` : ''}${parsed[4]}`
  return lines.join('\n')
}
export function taskSourceMarker(vaultId: string, taskId: string): string {
  return `Scriptor source: vault:${encodeURIComponent(vaultId)}:${taskId}`
}
export function layoutPlannerDay(entries: {id:string;start:string;end:string}[], date: string): {id:string;top:number;height:number;lane:number;lanes:number}[] {
  const midnight = new Date(`${date}T00:00:00`)
  const next = new Date(midnight);next.setDate(next.getDate()+1)
  const from = midnight.getTime(); const to = next.getTime()
  const rows = entries.map(row=>({...row,begin:Math.max(from,Date.parse(row.start)),finish:Math.min(to,Date.parse(row.end))})).filter(row=>row.finish>row.begin).sort((a,b)=>a.begin-b.begin)
  const lanes: number[] = []
  const result = rows.map(row=> {
    let lane=lanes.findIndex(finish=>finish<=row.begin)
    if(lane<0)lane=lanes.length
    lanes[lane]=row.finish
    return {id:row.id,top:(row.begin-from)/(to-from)*100,height:(row.finish-row.begin)/(to-from)*100,lane,lanes:1}
  })
  return result.map(row=>({...row,lanes:Math.max(1,lanes.length)}))
}
export function readPlannerBlocks(raw: string | null): PlannerBlock[] {
  if (!raw || raw.length > 1024 * 1024) return []
  try {
    const rows: unknown = JSON.parse(raw)
    if (!Array.isArray(rows)) return []
    return rows.slice(0,500).filter((row): row is PlannerBlock => {
      if (!row || typeof row !== 'object') return false
      const r = row as Record<string,unknown>
      return typeof r.taskId === 'string' && r.taskId.length < 1024 && typeof r.title === 'string' && r.title.length <= 2048 && typeof r.start === 'string' && typeof r.end === 'string' && Number.isFinite(Date.parse(r.start)) && Date.parse(r.end) > Date.parse(r.start) && (r.eventId === undefined || typeof r.eventId === 'string')
    }).map(row => ({...row, base: row.base && typeof row.base.title === 'string' && typeof row.base.start === 'string' && typeof row.base.end === 'string' ? row.base : undefined}))
  } catch { return [] }
}
