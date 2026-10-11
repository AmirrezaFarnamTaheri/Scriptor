import assert from 'node:assert/strict'
import test from 'node:test'
import { validateDatabaseView, databaseFilterJson, scalarFields, calculateValue, aggregateColumn, matchesMetadataFilters, isMissingDatabasePreset } from './databaseStudio.ts'

test('calendar calculations reject rollover dates', () => {
  assert.equal(calculateValue({op:'days-between',fields:['a','b']},{a:'2026-02-30',b:'2026-03-04'}),null)
})
test('scalar metadata filters match status and preserve any-filter candidate coverage', () => {
  const view=validateDatabaseView({schemaVersion:1,id:'v',label:'Done',mode:'table',combine:'any',filters:[{field:'metadata',key:'status',value:'Done'},{field:'title',value:'Research'}],columns:[]})
  assert.deepEqual(JSON.parse(databaseFilterJson(view)),{all:[{op:'title contains',value:''}]})
  assert.equal(matchesMetadataFilters(view,{status:'Done'},{title:'Other',tags:[],path:'Other.md',modifiedDays:10}),true)
  assert.equal(matchesMetadataFilters({...view,combine:'all'},{status:'Draft'},{title:'Research',tags:[],path:'a.md',modifiedDays:1}),false)
})
test('only exact native missing-note errors permit creating presets', () => {
  assert.equal(isMissingDatabasePreset('note not found: .scriptor/presets/database-studio.md'),true)
  assert.equal(isMissingDatabasePreset('Permission denied'),false)
  assert.equal(isMissingDatabasePreset('SyntaxError: unexpected token'),false)
})

test('database view persistence validates bounds and escapes path regex metacharacters', () => {
  const view = validateDatabaseView({ schemaVersion: 1, id: 'v', label: 'Research', mode: 'table', combine: 'all', filters: [{ field: 'path', value: 'Research/[notes]' }], columns: [{ key: 'score', label: 'Score' }] })
  assert.deepEqual(JSON.parse(databaseFilterJson(view)), { all: [{ op: 'path matches', value: 'Research/\\[notes\\]' }] })
  assert.throws(() => validateDatabaseView({ ...view, columns: Array(13).fill(view.columns[0]) }))
  assert.throws(() => validateDatabaseView({ ...view, filters: [{field:'days',value:'-2'}] }))
})

test('scalar metadata handles numeric/date/text values without treating nested YAML as cells', () => {
  assert.deepEqual(scalarFields('---\nscore: 12\nstatus: "draft"\ndue: 2026-10-01\ncomplex:\n  nested: secret\ntags: [a, b]\n---\nbody'), { score: 12, status: 'draft', due: '2026-10-01' })
  assert.equal(scalarFields('---\nscore: 1\nscore: 2\n---\nbody').score, undefined)
})

test('bounded declarative formulas reject executable payloads and propagate missing values', () => {
  assert.equal(calculateValue({ op: 'divide', fields: ['words', 'hours'] }, {words: 120, hours: 3}), 40)
  assert.equal(calculateValue({ op: 'divide', fields: ['words', 'hours'] }, {words: 120, hours: 0}), null)
  assert.equal(calculateValue({ op: 'upper', fields: ['status'] }, {status: 'draft'}), 'DRAFT')
  assert.equal(calculateValue({ op: 'days-between', fields: ['start','end'] }, { start: '2026-10-01', end: '2026-10-04' }), 3)
  assert.equal(calculateValue({ op: 'add', fields: ['missing', 'hours'] }, {hours: 3}), null)
  assert.throws(() => calculateValue({ op: 'eval', fields: ['x'] } as never, {x: 'alert(1)'}))
  assert.deepEqual(aggregateColumn([10,null,20,'not numeric']), { count: 2, sum: 30, average: 15, min: 10, max: 20 })
})
