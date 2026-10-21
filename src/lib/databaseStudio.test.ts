import assert from 'node:assert/strict'
import test from 'node:test'
import { validateDatabaseView, databaseFilterJson, scalarFields, calculateValue, aggregateColumn, matchesMetadataFilters, matchesTag, pathMatches, parseScalarCell, formatScalarCell, isMissingDatabasePreset } from './databaseStudio.ts'

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

test('database view persistence validates bounds and keeps path filters as regular expressions', () => {
  const view = validateDatabaseView({ schemaVersion: 1, id: 'v', label: 'Research', mode: 'table', combine: 'all', filters: [{ field: 'path', value: 'Research/[notes]' }], columns: [{ key: 'score', label: 'Score' }] })
  // The native `path matches` operator is a regular expression. Escaping the
  // pattern here made a regex filter match its own literal text.
  assert.deepEqual(JSON.parse(databaseFilterJson(view)), { all: [{ op: 'path matches', value: 'Research/[notes]' }] })
  assert.throws(() => validateDatabaseView({ ...view, columns: Array(13).fill(view.columns[0]) }))
  assert.throws(() => validateDatabaseView({ ...view, filters: [{field:'days',value:'-2'}] }))
})

test('path filters match the native regular-expression semantics', () => {
  // The native cases are the ones `crates/vault/src/views.rs` asserts.
  assert.equal(pathMatches('projects/alpha.md', '^projects/'), true)
  assert.equal(pathMatches('archive/projects/alpha.md', '^projects/'), false)
  assert.equal(pathMatches('daily/2026-06-20.md', 'daily/.*'), true)
  // An unclosed character class is not valid regex. With a wildcard present
  // the glob fallback runs and anchors the whole path; without one the
  // substring fallback runs instead.
  assert.equal(pathMatches('docs/readme[', 'docs/*['), true)
  assert.equal(pathMatches('other/readme[', 'docs/*['), false)
  assert.equal(pathMatches('notes/plan[x.md', 'plan['), true)
  assert.equal(pathMatches('notes/plan.md', 'plan['), false)
  // The native engine rejects look-around, atomic groups, possessive
  // quantifiers and backreferences, and falls back for them. JavaScript
  // compiles all of them, so the mirror must not treat them as regexes.
  assert.equal(pathMatches('notes/a.md', '(?=notes)notes'), false)
  assert.equal(pathMatches('notes/a.md', '(?!other)notes'), false)
  assert.equal(pathMatches('notes/a.md', '(?<=notes)a'), false)
  assert.equal(pathMatches('notes/a.md', '(?>notes)'), false)
  assert.equal(pathMatches('notes/a.md', 'notes++'), false)
  assert.equal(pathMatches('notes/a.md', '(a)\\1'), false)
  // The native engine supports the inline case-insensitive flag and the
  // Python-style named group that JavaScript spells differently.
  assert.equal(pathMatches('Notes/a.md', '(?i)^notes/'), true)
  // The inline flag must work on every supported runtime. The scoped flag
  // form `(?i:...)` is not available in every runtime, so a mirror that
  // relied on it silently stopped matching where the runtime lacked it and
  // the view dropped notes the native query had accepted.
  assert.equal(pathMatches('NOTES/a.md', '(?i)notes'), true)
  assert.equal(pathMatches('notes/a.md', '(?i)NOTES'), true)
  assert.equal(pathMatches('A.md', '(?i)[a-z]+'), true)
  assert.equal(pathMatches('a.md', '(?i)[A-Z]+'), true)
  // A class that carries the flag is case-insensitive on its own.
  assert.equal(pathMatches('A.md', '(?i)[(?i)a-z]'), true)
  // A shorthand escape is not a literal, so it is not folded.
  assert.equal(pathMatches('notes/1.md', '(?i)note\\w'), true)
  assert.equal(pathMatches('notes/a.md', '(?P<name>notes)'), true)
  // The flag applies to the remainder of the enclosing group, so the part
  // before it keeps its own case sensitivity.
  assert.equal(pathMatches('notes/aB.md', '(a(?i)b)'), true)
  assert.equal(pathMatches('notes/AB.md', '(a(?i)b)'), false)
  // A class that contains a bracket or a parenthesis is not a group.
  assert.equal(pathMatches('(notes/a.md', '[(]notes'), true)
  assert.equal(pathMatches('notes/a).md', '[)]'), true)
  // Constructs the native engine accepts must keep working as regular
  // expressions rather than falling back.
  assert.equal(pathMatches('notes/a.md', '(a+)'), true)
  assert.equal(pathMatches('notes/a.md', '(?:notes)'), true)
  assert.equal(pathMatches('notes/a.md', 'a{2}'), false)
  assert.equal(pathMatches('notes/a.md', '(a|b)+'), true)
  assert.equal(pathMatches('notes/a.md', '[a-z]+'), true)
})

test('tag filters ignore case and an optional leading hash like the native operator', () => {
  assert.equal(matchesTag(['Project'], 'project'), true)
  assert.equal(matchesTag(['project'], '#Project'), true)
  assert.equal(matchesTag(['project'], 'other'), false)
  // The native comparison folds ASCII only, so a non-ASCII tag that differs
  // only by case is not a match.
  assert.equal(matchesTag(['ÄPFEL'], 'äpfel'), false)
})

test('metadata filters combine with the native conditions', () => {
  const view = validateDatabaseView({
    schemaVersion: 1, id: 'v', label: 'Research', mode: 'table', combine: 'all',
    filters: [{ field: 'metadata', key: 'status', value: 'active' }, { field: 'tag', value: 'project' }],
    columns: [{ key: 'status', label: 'Status' }],
  })
  const note = { title: 'Plan', tags: ['Project'], path: 'plan.md', modifiedDays: 1 }
  assert.equal(matchesMetadataFilters(view, { status: 'active' }, note), true)
  assert.equal(matchesMetadataFilters(view, { status: 'archived' }, note), false)
  // The native query already applied the tag condition, so the client only
  // narrows the result by the metadata condition.
  assert.equal(matchesMetadataFilters(view, { status: 'active' }, { ...note, tags: ['other'] }), true)
  // A view without a metadata condition is left entirely to the native
  // evaluator, so the client does not narrow the candidate set again.
  const nativeOnly = validateDatabaseView({ ...view, filters: [{ field: 'tag', value: 'project' }] })
  assert.equal(matchesMetadataFilters(nativeOnly, {}, { ...note, tags: ['other'] }), true)
  // An `any` group with a metadata condition is the one case the native
  // query cannot express, so the whole disjunction is evaluated here.
  const anyView = validateDatabaseView({ ...view, combine: 'any' })
  assert.equal(matchesMetadataFilters(anyView, { status: 'active' }, note), true)
  // The tag condition still holds, so the disjunction holds as well.
  assert.equal(matchesMetadataFilters(anyView, { status: 'archived' }, note), true)
  // No condition holds when the metadata value is absent and the tag differs.
  assert.equal(matchesMetadataFilters(anyView, {}, { ...note, tags: ['other'] }), false)
})

test('scalar cells round-trip through YAML without changing type', () => {
  // A text value that looks like another type keeps its type.
  assert.equal(parseScalarCell('2026'), 2026)
  assert.equal(parseScalarCell('"2026"'), '2026')
  assert.equal(formatScalarCell('2026'), '"2026"')
  assert.equal(formatScalarCell('draft'), 'draft')
  assert.equal(formatScalarCell(true), 'true')
  assert.equal(formatScalarCell(null), 'null')
  assert.equal(formatScalarCell(12), '12')
  // Text that would be truncated or re-read as a comment stays quoted.
  assert.equal(formatScalarCell('a # b'), '"a # b"')
  assert.equal(formatScalarCell(' padded '), '" padded "')
  assert.equal(parseScalarCell(formatScalarCell('2026')), '2026')
  // YAML accepts the exponent form, so a number written in it reads back as
  // a number rather than as text.
  assert.equal(parseScalarCell('1e3'), 1000)
  assert.equal(parseScalarCell('1.5E-3'), 0.0015)
  assert.equal(parseScalarCell(formatScalarCell(1e21)), 1e21)
  assert.equal(parseScalarCell(formatScalarCell(5e-324)), 5e-324)
  // Text that merely looks numeric keeps its type.
  assert.equal(formatScalarCell('1e3'), '"1e3"')
  assert.equal(parseScalarCell(formatScalarCell('1e3')), '1e3')
  // The editor parser and the table reader must agree on every written form.
  for (const value of ['draft', '2026', 'null', 'true', '123', '1.5', '1e3', '2026-10-01', 'a # b', ' padded ']) {
    const written = formatScalarCell(value)
    assert.equal(parseScalarCell(written), scalarFields(`---\nfield: ${written}\n---\nbody`).field, `editor and table disagree for ${JSON.stringify(value)}`)
  }
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
