import { useEffect, useMemo, useRef, useState } from 'react'
import type { TaskRow } from '../hooks/useTaskStore'
import type { RunSourceNoteMutation } from '../hooks/useTaskStore'
import { googleCalendarCreateTask, googlePlannerWrite, type CalendarEvent, type GoogleTask } from '../bridge/commands/google_calendar'
import { vaultReadNote, vaultSaveNote } from '../bridge/commands/vault'
import { indexerSyncNoteTasks } from '../bridge/commands/indexer'
import { layoutPlannerDay, planReconciliation, readPlannerBlocks, rewritePlannerTask, taskSourceMarker, weekDays, type PlannerBlock, type PlannerTaskValue } from '../lib/planner'
import { formatLocalDate } from '@scriptor/core/date'
import '../styles/planner.css'

export interface PlannerWorkspaceProps {
  vaultId: string
  tasks: TaskRow[]
  events: CalendarEvent[]
  remoteTasks: GoogleTask[]
  calendarId: string
  taskListId: string
  connected: boolean
  runSourceNoteMutation?: RunSourceNoteMutation
  onReload: () => void | Promise<void>
  onOpenNote: (path: string) => void
}
type Review = { kind: 'task'; task: TaskRow; remote?: GoogleTask; direction: string } | {kind: 'event'; block: PlannerBlock; remote?: CalendarEvent; direction: string}
const taskValue = (task: TaskRow): PlannerTaskValue => ({title:task.title,done:task.status === 'done' || task.status === 'cancelled',due:task.dueAt})
const remoteValue = (task: GoogleTask): PlannerTaskValue => ({title:task.title,done:task.status === 'completed',due:task.due?.slice(0,10) ?? null})
const eventValue = (event: CalendarEvent) => ({title:event.summary,start:event.start,end:event.end})
const inputTime = (iso: string) => { const date = new Date(iso); return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16) }
function readBases(key: string): Record<string,PlannerTaskValue> {
  try {
    const raw = localStorage.getItem(key)
    if (!raw || raw.length > 1024*1024) return {}
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    return Object.fromEntries(Object.entries(value).slice(0,500).filter(([,row]) => row && typeof row.title === 'string' && row.title.length <= 2048 && typeof row.done === 'boolean' && (row.due === null || /^\d{4}-\d{2}-\d{2}$/.test(row.due))))
  } catch { return {} }
}

/** Local scheduling stays available offline. Provider changes require review and native consent. */
export function PlannerWorkspace({vaultId,tasks,events,remoteTasks,calendarId,taskListId,connected,runSourceNoteMutation,onReload,onOpenNote}: PlannerWorkspaceProps) {
  const storageKey = `scriptor:planner:v1:${encodeURIComponent(vaultId)}`
  const baseKey = `${storageKey}:tasks:${encodeURIComponent(taskListId)}`
  const [blocks,setBlocks] = useState<PlannerBlock[]>(() => {try {return readPlannerBlocks(localStorage.getItem(storageKey))} catch {return []}})
  const [bases,setBases] = useState(() => readBases(baseKey))
  const [day,setDay] = useState(formatLocalDate())
  const [taskId,setTaskId] = useState('')
  const [start,setStart] = useState(`${formatLocalDate()}T09:00`)
  const [end,setEnd] = useState(`${formatLocalDate()}T10:00`)
  const [eventId,setEventId] = useState('')
  const [review,setReview] = useState<Review[] | null>(null)
  const [busy,setBusy] = useState(false)
  const [message,setMessage] = useState<string | null>(null)
  const cancelRef = useRef(false)
  useEffect(()=>()=>{cancelRef.current=true},[])
  const days = useMemo(() => weekDays(day), [day])
  const saveBlocks = (next: PlannerBlock[]) => {
    if (next.length > 500) throw new Error('Planner supports up to 500 mapped time blocks')
    localStorage.setItem(storageKey,JSON.stringify(next)); setBlocks(next)
  }
  const saveBase = (id: string,value: PlannerTaskValue) => {
    const next = {...bases,[id]:value}; localStorage.setItem(baseKey,JSON.stringify(next));setBases(next)
  }
  const schedule = () => {
    try {
      const task = tasks.find(row => row.id === taskId)
      if (!task) throw new Error('Choose a vault task to schedule')
      const begin = new Date(start); const finish = new Date(end)
      if (!Number.isFinite(begin.getTime()) || finish <= begin || finish.getTime()-begin.getTime() > 7*86400000) throw new Error('Choose an end after the start, within seven days')
      const remote = events.find(row => row.id === eventId)
      const prior = blocks.find(row => row.taskId === taskId)
      const block: PlannerBlock = {taskId,title:task.title,start:begin.toISOString(),end:finish.toISOString(),eventId:remote?.id ?? prior?.eventId,base:remote ? eventValue(remote) : prior?.base}
      saveBlocks([...blocks.filter(row => row.taskId !== taskId),block]); setReview(null);setMessage('Time block saved on this device.')
    } catch(error) {setMessage(String(error))}
  }
  const prepare = () => {
    const rows: Review[] = []
    const nextBases = {...bases}
    for (const task of tasks) {
      const matches = remoteTasks.filter(remote => (remote.notes ?? '').split('\n').includes(taskSourceMarker(vaultId,task.id)))
      if (matches.length > 1) { rows.push({kind:'task',task,direction:'duplicate mapping'});continue }
      const remote = matches[0]
      const direction = remote ? planReconciliation(bases[task.id] ?? null,taskValue(task),remoteValue(remote)) : 'create'
      if (direction !== 'equal') rows.push({kind:'task',task,remote,direction})
      else nextBases[task.id] = taskValue(task)
    }
    for (const block of blocks) {
      const remote = events.find(event => event.id === block.eventId)
      const local = {title:block.title,start:block.start,end:block.end}
      const direction = remote ? planReconciliation(block.base ?? null,local,eventValue(remote)) : block.eventId ? 'missing event' : 'create'
      if (direction !== 'equal') rows.push({kind:'event',block,remote,direction})
    }
    try {localStorage.setItem(baseKey,JSON.stringify(nextBases));setBases(nextBases)} catch(error) {setMessage(String(error));return}
    setReview(rows);setMessage(rows.length ? 'Review each change. Conflicts require a direction; nothing is applied automatically.' : 'No differences in the loaded task and event window.')
  }
  const apply = async (row: Review,direction: 'push' | 'pull') => {
    if (busy) return
    setBusy(true);cancelRef.current=false;setMessage(null)
    try {
      if (row.kind === 'task') {
        const value = direction === 'pull' && row.remote ? remoteValue(row.remote) : taskValue(row.task)
        if (direction === 'pull') {
          const path = row.task.sourceNotePath
          if (!path) throw new Error('Task has no source note')
          const mutate = async () => {
            const note = await vaultReadNote(path)
            const markdown = rewritePlannerTask(note.markdown,row.task,value)
            if (cancelRef.current) throw new Error('Cancelled before saving')
            await vaultSaveNote(path,markdown,note.metadata.content_hash,false,vaultId)
            await indexerSyncNoteTasks(path)
          }
          if (runSourceNoteMutation) {if (!await runSourceNoteMutation(path,mutate)) throw new Error('Save the source note before importing')}
          else await mutate()
        } else if (row.remote) {
          if (!row.remote.etag) throw new Error('Refresh Google Tasks to obtain its provider revision')
          await googlePlannerWrite({kind:'task',taskListId,taskId:row.remote.id,etag:row.remote.etag,title:value.title,due:value.due ? `${value.due}T00:00:00Z` : null,done:value.done})
        } else {
          if (row.direction === 'duplicate mapping') throw new Error('Resolve duplicate provider mappings before syncing')
          await googleCalendarCreateTask({taskListId,title:value.title,notes:taskSourceMarker(vaultId,row.task.id),due:value.due ? `${value.due}T00:00:00Z` : null})
          if (value.done) throw new Error('Task created. Refresh, then review its completed status.')
        }
        saveBase(row.task.id,value)
      } else {
        let block = {...row.block}
        if (direction === 'pull' && row.remote) {
          if (row.remote.status === 'cancelled') throw new Error('Google event was cancelled. Remove or reschedule the local block explicitly.')
          if (row.remote.allDay) throw new Error('All-day events are shown in the week. Map a timed event for time blocking.')
          block = {...block,...eventValue(row.remote),base:eventValue(row.remote)}
        } else {
          if (block.eventId && !row.remote) throw new Error('Event is outside the loaded window or was removed. Refresh or unlink before recreating.')
          const id = row.remote?.id ?? blocks.find(item=>item.taskId===block.taskId)?.eventId ?? `scriptor${crypto.randomUUID().replaceAll('-','')}`
          // Persist the identity before submission; retries cannot create a second event.
          block = {...block,eventId:id}
          saveBlocks(blocks.map(item => item.taskId === block.taskId ? block : item))
          const result = await googlePlannerWrite({kind:'event',calendarId,eventId:id,etag:row.remote?.etag ?? null,title:block.title,start:block.start,end:block.end,create:!row.remote})
          block = {...block,eventId:result.id,base:{title:block.title,start:block.start,end:block.end}}
        }
        saveBlocks(blocks.map(item => item.taskId === block.taskId ? block : item))
      }
      setReview(null);await onReload();setMessage(cancelRef.current ? 'The active change finished. Review stopped; applied changes remain saved.' : 'Change applied. Refresh and review the remaining differences.')
    } catch(error) {setMessage(String(error))} finally {setBusy(false)}
  }
  const shownEvents = events.filter(event => !blocks.some(block => block.eventId === event.id))
  const timed = [...blocks.map(block=>({id:`local:${block.taskId}`,start:block.start,end:block.end,title:block.title,block})),...shownEvents.filter(event=>!event.allDay && event.status!=='cancelled').map(event=>({id:`remote:${event.id}`,start:event.start,end:event.end,title:event.summary,block:undefined}))]
  return <section className="planner-workspace" aria-label="Weekly planner">
    <div className="section-heading-row"><h3>Weekly planner</h3><label className="planner-week-control">Week containing <input type="date" value={day} onChange={e=>setDay(e.target.value || formatLocalDate())}/></label></div>
    <p className="health-subtitle">Time blocks are stored on this device. Google Tasks due dates have no time; timed scheduling uses Calendar events. Sync affects only mapped tasks and explicitly mapped events.</p>
    <div className="planner-week" role="list" aria-label="Week time grid">
      {days.map(date => <section role="listitem" className="planner-day" key={date} aria-label={date}>
        <h4><time dateTime={date}>{new Date(`${date}T12:00:00`).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})}</time></h4>
        <div className="planner-day__timeline"><div className="planner-day__hours" aria-hidden="true">{[0,6,12,18].map(hour=><span key={hour}>{String(hour).padStart(2,'0')}:00</span>)}</div>
          {layoutPlannerDay(timed,date).map(slot=>{const item=timed.find(row=>row.id===slot.id)!;return <button type="button" key={item.id} className={`planner-block ${item.block?'':'planner-block--remote'}`} style={{insetBlockStart:`${slot.top}%`,height:`${slot.height}%`,insetInlineStart:`${slot.lane/slot.lanes*100}%`,width:`${100/slot.lanes}%`}} onClick={()=>{if(item.block){setTaskId(item.block.taskId);setStart(inputTime(item.start));setEnd(inputTime(item.end));setEventId(item.block.eventId??'')}else{setEventId(item.id.slice(7));setStart(inputTime(item.start));setEnd(inputTime(item.end))}}}><strong dir="auto">{item.title}</strong><time>{new Date(item.start).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})} – {new Date(item.end).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})}</time></button>})}
        </div><div className="planner-day__entries">
          {shownEvents.filter(event => event.allDay && event.start<=date && event.end>date).map(event => <div className="planner-block planner-block--remote" key={event.id}><strong dir="auto">{event.summary}</strong><span>All day</span></div>)}
          {tasks.filter(task=>task.dueAt === date).map(task=><button type="button" className="planner-due" key={task.id} onClick={()=>task.sourceNotePath && onOpenNote(task.sourceNotePath)}>Due: {task.title}</button>)}
        </div>
      </section>)}
    </div>
    <form className="planner-schedule" onSubmit={event=>{event.preventDefault();schedule()}}>
      <label>Vault task<select value={taskId} onChange={e=>setTaskId(e.target.value)} required><option value="">Choose task</option>{tasks.map(task=><option key={task.id} value={task.id}>{task.title}</option>)}</select></label>
      <label>Start<input type="datetime-local" value={start} onChange={e=>setStart(e.target.value)} required/></label><label>End<input type="datetime-local" value={end} onChange={e=>setEnd(e.target.value)} required/></label>
      <label>Google event<select value={eventId} onChange={e=>{setEventId(e.target.value);const event=events.find(row=>row.id===e.target.value);if(event && !event.allDay){setStart(inputTime(event.start));setEnd(inputTime(event.end))}}}><option value="">Create event when synced</option>{events.filter(event=>!event.allDay && event.status!=='cancelled').map(event=><option key={event.id} value={event.id}>{event.summary}</option>)}</select></label>
      <button type="submit" className="toolbar-button" disabled={busy}>Save time block</button>
      {blocks.some(block=>block.taskId===taskId) && <button type="button" className="toolbar-button" disabled={busy} onClick={()=>{try{saveBlocks(blocks.filter(block=>block.taskId!==taskId));setReview(null);setMessage('Local block removed. Its Google event remains unchanged.')}catch(error){setMessage(String(error))}}}>Remove local block</button>}
    </form>
    <button type="button" className="toolbar-button" disabled={!connected || busy} onClick={prepare}>Review bidirectional sync</button>
    {message && <p role="status" className="health-subtitle">{message}</p>}
    {review && <div className="planner-review" aria-label="Sync review"><p>{review.length} changes · Google → vault or vault → Google. Each provider write asks for permission.</p>{review.map((row,index)=><div className="planner-review__row" key={index}><strong dir="auto">{row.kind==='task'?row.task.title:row.block.title}</strong><span>{row.direction}</span><pre>{JSON.stringify(row.kind==='task'?{vault:taskValue(row.task),google:row.remote?remoteValue(row.remote):null}:{vault:row.block,google:row.remote?eventValue(row.remote):null},null,2)}</pre><div className="planner-review__actions"><button type="button" disabled={busy || row.direction==='duplicate mapping'} onClick={()=>void apply(row,'push')}>Use vault → Google</button><button type="button" disabled={busy || !row.remote} onClick={()=>void apply(row,'pull')}>Use Google → vault</button></div></div>)}<button type="button" onClick={()=>{cancelRef.current=true;if(!busy)setReview(null);setMessage(busy?'Stopping after the active change. A sent provider request cannot be recalled.':'Review cancelled. No further changes applied.')}}>Cancel review</button></div>}
  </section>
}
