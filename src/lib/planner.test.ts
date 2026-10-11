import test from 'node:test'
import assert from 'node:assert/strict'
import { planReconciliation, weekDays, rewritePlannerTask, layoutPlannerDay } from './planner.ts'

test('three-way planner sync pulls provider edits, pushes local edits, and exposes simultaneous conflicts', () => {
  const base = { title: 'Draft', done: false, due: null }
  assert.equal(planReconciliation(base, base, { ...base, done: true }), 'pull')
  assert.equal(planReconciliation(base, { ...base, title: 'Revise' }, base), 'push')
  assert.equal(planReconciliation(base, { ...base, title: 'Revise' }, { ...base, done: true }), 'conflict')
  assert.equal(planReconciliation(null, base, { ...base, done: true }), 'conflict')
})
test('time grid places overlapping blocks in separate lanes and clips cross-midnight spans',()=>{
  const result = layoutPlannerDay([
    {id:'a',start:'2026-10-01T09:00:00',end:'2026-10-01T11:00:00'},
    {id:'b',start:'2026-10-01T10:00:00',end:'2026-10-01T12:00:00'},
    {id:'c',start:'2026-09-30T23:00:00',end:'2026-10-01T01:00:00'},
  ],'2026-10-01')
  assert.notEqual(result.find(row=>row.id==='a')?.lane,result.find(row=>row.id==='b')?.lane)
  assert.equal(result.find(row=>row.id==='a')?.top,9/24*100)
  assert.equal(result.find(row=>row.id==='c')?.top,0)
})
test('week starts Monday across year boundaries', () => {
  assert.deepEqual(weekDays('2027-01-01'), ['2026-12-28','2026-12-29','2026-12-30','2026-12-31','2027-01-01','2027-01-02','2027-01-03'])
})
test('remote task rewrite preserves unrelated metadata and fails on a stale source line', () => {
  const task = { line: 1, title: 'Draft #work', status: 'open', dueAt: '2026-10-01' }
  const source = '# Plan\r\n- [ ] Draft #work \u{1F4C5} 2026-10-01 \u23F3 2026-09-30\r\n'
  const next = rewritePlannerTask(source, task, {title:'Revised #work',done:true,due:'2026-10-03'})
  assert.equal(next, '# Plan\r\n- [x] Revised #work \u23F3 2026-09-30 \u{1F4C5} 2026-10-03\r\n')
  assert.throws(() => rewritePlannerTask(source.replace('Draft','Changed'), task, {title:'Revised',done:true,due:null}), /changed/)
  assert.throws(() => rewritePlannerTask(source.replace('\u{1F4C5} 2026-10-01','\u{1F4C5} 2026-10-02'), task, {title:'Revised',done:true,due:null}), /changed/)
})
