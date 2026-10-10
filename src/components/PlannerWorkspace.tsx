import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { TaskRow } from '../hooks/useTaskStore'
import type { RunSourceNoteMutation } from '../hooks/useTaskStore'
import { googleCalendarCreateTask, googlePlannerWrite, type CalendarEvent, type GoogleTask } from '../bridge/commands/google_calendar'
import { vaultReadNote, vaultSaveNote } from '../bridge/commands/vault'
import { indexerSyncNoteTasks } from '../bridge/commands/indexer'
import { layoutPlannerDay, planReconciliation, rewritePlannerTask, taskSourceMarker, weekDays, type PlannerBlock, type PlannerTaskValue } from '../lib/planner'
import { plannerGoogleTaskBaseKey, readGoogleOwnedPlannerBlocks, serializeGoogleOwnedPlannerBlocks } from '../lib/plannerGoogleOwnership'
import { formatLocalDate } from '@scriptor/core/date'
import '../styles/planner.css'
import { useI18n } from '../lib/i18n'

const CALENDAR_WRITE_HELP = {
  en: 'Calendar writes are unavailable until a writable calendar is confirmed in Google settings. You can still review and import its events.',
  de: 'Kalenderänderungen sind erst nach Bestätigung eines beschreibbaren Kalenders in den Google-Einstellungen verfügbar. Sie können Ereignisse weiterhin prüfen und importieren.',
  fa: 'تا تأیید یک تقویم قابل‌ویرایش در تنظیمات گوگل، نوشتن در تقویم در دسترس نیست. همچنان می‌توانید رویدادها را بررسی و وارد کنید.',
}

export interface PlannerWorkspaceProps {
  vaultId: string
  tasks: TaskRow[]
  events: CalendarEvent[]
  remoteTasks: GoogleTask[]
  calendarId: string
  taskListId: string
  connected: boolean
  googleAccount?: string | null
  calendarWritable?: boolean
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
export function PlannerWorkspace({vaultId,tasks,events,remoteTasks,calendarId,taskListId,connected,googleAccount = null,calendarWritable = false,runSourceNoteMutation,onReload,onOpenNote}: PlannerWorkspaceProps) {
  const { locale, t } = useI18n()
  const storageKey = `scriptor:planner:v1:${encodeURIComponent(vaultId)}`
  const owner = googleAccount ? { account: googleAccount, calendarId } : null
  const baseKey = plannerGoogleTaskBaseKey(vaultId, googleAccount, taskListId)
  const [blocks,setBlocks] = useState<PlannerBlock[]>(() => {try {return readGoogleOwnedPlannerBlocks(localStorage.getItem(storageKey), owner)} catch {return []}})
  const [bases,setBases] = useState(() => readBases(baseKey))
  const [day,setDay] = useState(formatLocalDate())
  const [taskId,setTaskId] = useState('')
  const [taskSearch,setTaskSearch] = useState('')
  const [start,setStart] = useState(`${formatLocalDate()}T09:00`)
  const [end,setEnd] = useState(`${formatLocalDate()}T10:00`)
  const [eventId,setEventId] = useState('')
  const [review,setReview] = useState<Review[] | null>(null)
  const [busy,setBusy] = useState(false)
  const [message,setMessage] = useState<string | null>(null)
  const cancelRef = useRef(false)
  const mountedRef = useRef(false)
  const contextKey = JSON.stringify([vaultId, googleAccount, calendarId, taskListId])
  const currentContextRef = useRef(contextKey)
  useLayoutEffect(() => { currentContextRef.current = contextKey }, [contextKey])
  const contextCurrent = () => mountedRef.current && currentContextRef.current === contextKey
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false; cancelRef.current = true }
  }, [])
  const days = useMemo(() => weekDays(day), [day])
  // Bound DOM option counts without hiding tasks past an arbitrary index.
  const taskChoices = useMemo(() => {
    const query = taskSearch.trim().toLocaleLowerCase()
    const selected = tasks.find(task => task.id === taskId)
    const matches = tasks.filter(task => task.id !== taskId && (!query || task.title.toLocaleLowerCase().includes(query) || (task.sourceNotePath ?? '').toLocaleLowerCase().includes(query))).slice(0, 199)
    return selected ? [selected, ...matches] : matches.slice(0, 200)
  }, [tasks, taskId, taskSearch])
  const saveBlocks = (next: PlannerBlock[]) => {
    if (!contextCurrent()) return
    if (next.length > 500) throw new Error(t('plannerWorkspace.limitBlocks'))
    localStorage.setItem(storageKey,serializeGoogleOwnedPlannerBlocks(next, owner)); setBlocks(next)
  }
  const saveBase = (id: string,value: PlannerTaskValue) => {
    if (!contextCurrent()) return
    const next = {...bases,[id]:value}; localStorage.setItem(baseKey,JSON.stringify(next));setBases(next)
  }
  const schedule = () => {
    if (!contextCurrent()) return
    try {
      const task = tasks.find(row => row.id === taskId)
      if (!task) throw new Error(t('plannerWorkspace.selectTaskError'))
      const begin = new Date(start); const finish = new Date(end)
      if (!Number.isFinite(begin.getTime()) || finish <= begin || finish.getTime()-begin.getTime() > 7*86400000) throw new Error(t('plannerWorkspace.durationError'))
      const remote = events.find(row => row.id === eventId)
      const prior = blocks.find(row => row.taskId === taskId)
      const block: PlannerBlock = {taskId,title:task.title,start:begin.toISOString(),end:finish.toISOString(),eventId:remote?.id ?? prior?.eventId,base:remote ? eventValue(remote) : prior?.base}
      saveBlocks([...blocks.filter(row => row.taskId !== taskId),block]); setReview(null);setMessage(t('plannerWorkspace.blockSaved'))
    } catch(error) {setMessage(String(error))}
  }
  const prepare = () => {
    if (!contextCurrent()) return
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
    setReview(rows);setMessage(rows.length ? t('plannerWorkspace.reviewInstructions') : t('plannerWorkspace.noDiffs'))
  }
  const apply = async (row: Review,direction: 'push' | 'pull') => {
    if (busy || !contextCurrent()) return
    if (!connected) { setMessage(t('plannerWorkspace.refreshConnection')); return }
    if (direction === 'push' && row.kind === 'event' && !calendarWritable) {
      setMessage(CALENDAR_WRITE_HELP[locale])
      return
    }
    setBusy(true);cancelRef.current=false;setMessage(null)
    try {
      if (row.kind === 'task') {
        const value = direction === 'pull' && row.remote ? remoteValue(row.remote) : taskValue(row.task)
        if (direction === 'pull') {
          const path = row.task.sourceNotePath
          if (!path) throw new Error(t('plannerWorkspace.missingSource'))
          const mutate = async () => {
            if (!contextCurrent()) return
            const note = await vaultReadNote(path)
            if (!contextCurrent()) return
            const markdown = rewritePlannerTask(note.markdown,row.task,value)
            if (cancelRef.current) throw new Error(t('plannerWorkspace.cancelledBeforeSave'))
            await vaultSaveNote(path,markdown,note.metadata.content_hash,false,vaultId)
            if (!contextCurrent()) return
            await indexerSyncNoteTasks(path)
          }
          if (runSourceNoteMutation) {if (!await runSourceNoteMutation(path,mutate)) throw new Error(t('plannerWorkspace.saveSourceFirst'))}
          else await mutate()
        } else if (row.remote) {
          if (!row.remote.etag) throw new Error(t('plannerWorkspace.refreshTaskRevision'))
          await googlePlannerWrite({kind:'task',taskListId,taskId:row.remote.id,etag:row.remote.etag,title:value.title,due:value.due ? `${value.due}T00:00:00Z` : null,done:value.done})
        } else {
          if (row.direction === 'duplicate mapping') throw new Error(t('plannerWorkspace.duplicateMapping'))
          await googleCalendarCreateTask({taskListId,title:value.title,notes:taskSourceMarker(vaultId,row.task.id),due:value.due ? `${value.due}T00:00:00Z` : null})
          if (!contextCurrent()) return
          if (value.done) throw new Error(t('plannerWorkspace.taskCreatedPendingReview'))
        }
        if (!contextCurrent()) return
        saveBase(row.task.id,value)
      } else {
        let block = {...row.block}
        if (direction === 'pull' && row.remote) {
          if (row.remote.status === 'cancelled') throw new Error(t('plannerWorkspace.eventCancelled'))
          if (row.remote.allDay) throw new Error(t('plannerWorkspace.allDayError'))
          block = {...block,...eventValue(row.remote),base:eventValue(row.remote)}
        } else {
          if (block.eventId && !row.remote) throw new Error(t('plannerWorkspace.eventMissing'))
          const id = row.remote?.id ?? blocks.find(item=>item.taskId===block.taskId)?.eventId ?? `scriptor${crypto.randomUUID().replaceAll('-','')}`
          // Persist the identity before submission; retries cannot create a second event.
          block = {...block,eventId:id}
          saveBlocks(blocks.map(item => item.taskId === block.taskId ? block : item))
          const result = await googlePlannerWrite({kind:'event',calendarId,eventId:id,etag:row.remote?.etag ?? null,title:block.title,start:block.start,end:block.end,create:!row.remote})
          if (!contextCurrent()) return
          block = {...block,eventId:result.id,base:{title:block.title,start:block.start,end:block.end}}
        }
        saveBlocks(blocks.map(item => item.taskId === block.taskId ? block : item))
      }
      if (!contextCurrent()) return
      setReview(null);await onReload()
      if (contextCurrent()) setMessage(cancelRef.current ? t('plannerWorkspace.activeFinished') : t('plannerWorkspace.changeApplied'))
    } catch(error) {if (contextCurrent()) setMessage(String(error))} finally {if (contextCurrent()) setBusy(false)}
  }
  const shownEvents = events.filter(event => !blocks.some(block => block.eventId === event.id))
  const timed = [...blocks.map(block=>({id:`local:${block.taskId}`,start:block.start,end:block.end,title:block.title,block})),...shownEvents.filter(event=>!event.allDay && event.status!=='cancelled').map(event=>({id:`remote:${event.id}`,start:event.start,end:event.end,title:event.summary,block:undefined}))]
  return <section className="planner-workspace" aria-label={t('plannerWorkspace.title')} lang={locale} dir={locale === 'fa' ? 'rtl' : 'ltr'}>
    <div className="section-heading-row"><h3>{t('plannerWorkspace.title')}</h3><label className="planner-week-control">{t('plannerWorkspace.weekContaining')} <input type="date" value={day} onChange={e=>setDay(e.target.value || formatLocalDate())}/></label></div>
    <p className="health-subtitle">{t('plannerWorkspace.explanation')}</p>
    {connected && !calendarWritable && <p className="health-subtitle" role="note">{CALENDAR_WRITE_HELP[locale]}</p>}
    <div className="planner-week" role="list" aria-label={t('plannerWorkspace.weekGrid')}>
      {days.map(date => <section role="listitem" className="planner-day" key={date} aria-label={date}>
        <h4><time dateTime={date}>{new Date(`${date}T12:00:00`).toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})}</time></h4>
        <div className="planner-day__timeline"><div className="planner-day__hours" aria-hidden="true">{[0,6,12,18].map(hour=><span key={hour}>{String(hour).padStart(2,'0')}:00</span>)}</div>
          {layoutPlannerDay(timed,date).map(slot=>{const item=timed.find(row=>row.id===slot.id)!;return <button type="button" key={item.id} className={`planner-block ${item.block?'':'planner-block--remote'}`} style={{insetBlockStart:`${slot.top}%`,height:`${slot.height}%`,insetInlineStart:`${slot.lane/slot.lanes*100}%`,width:`${100/slot.lanes}%`}} onClick={()=>{if(item.block){setTaskId(item.block.taskId);setStart(inputTime(item.start));setEnd(inputTime(item.end));setEventId(item.block.eventId??'')}else{setEventId(item.id.slice(7));setStart(inputTime(item.start));setEnd(inputTime(item.end))}}}><strong dir="auto">{item.title}</strong><time>{new Date(item.start).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})} – {new Date(item.end).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})}</time></button>})}
        </div><div className="planner-day__entries">
          {shownEvents.filter(event => event.allDay && event.start<=date && event.end>date).map(event => <div className="planner-block planner-block--remote" key={event.id}><strong dir="auto">{event.summary}</strong><span>{t('plannerWorkspace.allDay')}</span></div>)}
          {tasks.filter(task=>task.dueAt === date).map(task=><button type="button" className="planner-due" key={task.id} onClick={()=>task.sourceNotePath && onOpenNote(task.sourceNotePath)} disabled={!task.sourceNotePath} aria-label={t('plannerWorkspace.dueTask', {title: task.title})}>{t('plannerWorkspace.dueLabel')} <bdi>{task.title}</bdi></button>)}
        </div>
      </section>)}
    </div>
    <form className="planner-schedule" onSubmit={event=>{event.preventDefault();schedule()}}>
      <label>{t('plannerWorkspace.searchTasks')}<input type="search" value={taskSearch} onChange={event=>setTaskSearch(event.target.value)} placeholder={t('plannerWorkspace.searchPlaceholder')} /></label>
       <label>{t('plannerWorkspace.vaultTask')}<select value={taskId} onChange={e=>setTaskId(e.target.value)} required><option value="">{t('plannerWorkspace.chooseTask')}</option>{taskChoices.map(task=><option key={task.id} value={task.id}>{task.title}</option>)}</select></label>
       <p className="health-subtitle" role="status">{t('plannerWorkspace.taskCount', {shown: taskChoices.length, total: tasks.length})}</p>
      <label>{t('plannerWorkspace.start')}<input type="datetime-local" value={start} onChange={e=>setStart(e.target.value)} required/></label><label>{t('plannerWorkspace.end')}<input type="datetime-local" value={end} onChange={e=>setEnd(e.target.value)} required/></label>
      <label>{t('plannerWorkspace.googleEvent')}<select value={eventId} onChange={e=>{setEventId(e.target.value);const event=events.find(row=>row.id===e.target.value);if(event && !event.allDay){setStart(inputTime(event.start));setEnd(inputTime(event.end))}}}><option value="">{t('plannerWorkspace.createWhenSynced')}</option>{events.filter(event=>!event.allDay && event.status!=='cancelled').map(event=><option key={event.id} value={event.id}>{event.summary}</option>)}</select></label>
      <button type="submit" className="toolbar-button" disabled={busy}>{t('plannerWorkspace.saveBlock')}</button>
      {blocks.some(block=>block.taskId===taskId) && <button type="button" className="toolbar-button" disabled={busy} onClick={()=>{try{saveBlocks(blocks.filter(block=>block.taskId!==taskId));setReview(null);setMessage(t('plannerWorkspace.localRemoved'))}catch(error){setMessage(String(error))}}}>{t('plannerWorkspace.removeBlock')}</button>}
    </form>
    <button type="button" className="toolbar-button" disabled={!connected || busy} onClick={prepare}>{t('plannerWorkspace.reviewSync')}</button>
    {message && <p role="status" className="health-subtitle">{message}</p>}
    {review && <div className="planner-review" role="region" aria-label={t('plannerWorkspace.reviewRegion')} aria-busy={busy}><p>{t('plannerWorkspace.reviewCount', {count: review.length})}</p>{review.map((row,index)=><div className="planner-review__row" key={index}><strong dir="auto">{row.kind==='task'?row.task.title:row.block.title}</strong><span>{row.direction}</span><pre>{JSON.stringify(row.kind==='task'?{vault:taskValue(row.task),google:row.remote?remoteValue(row.remote):null}:{vault:row.block,google:row.remote?eventValue(row.remote):null},null,2)}</pre><div className="planner-review__actions"><button type="button" disabled={!connected || busy || row.direction==='duplicate mapping' || (row.kind==='event' && !calendarWritable)} onClick={()=>void apply(row,'push')}>{t('plannerWorkspace.push')}</button><button type="button" disabled={!connected || busy || !row.remote} onClick={()=>void apply(row,'pull')}>{t('plannerWorkspace.pull')}</button></div></div>)}<button type="button" onClick={()=>{cancelRef.current=true;if(!busy)setReview(null);setMessage(busy?t('plannerWorkspace.cancelAfterActive'):t('plannerWorkspace.cancelledReview'))}}>{t('plannerWorkspace.cancelReview')}</button></div>}
  </section>
}
