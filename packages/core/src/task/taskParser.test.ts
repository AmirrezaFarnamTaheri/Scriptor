import assert from 'node:assert/strict'
import { test } from 'node:test'

import { parseTasksFromMarkdown, serializeTask } from './taskParser.ts'

test('task parser excludes fenced and top-level indented code examples', () => {
  const markdown = [
    '- [ ] real task',
    '',
    '```markdown',
    '- [ ] fenced example',
    '- [/] extended fenced example',
    '```',
    '',
    '    - [ ] top-level indented code example',
    '',
    '- [x] completed task',
  ].join('\n')

  const tasks = parseTasksFromMarkdown(markdown, 'note.md')
  assert.deepEqual(tasks.map(task => task.text), ['real task', 'completed task'])
})

test('task parser excludes blockquoted examples', () => {
  const tasks = parseTasksFromMarkdown(
    '> - [ ] quoted example\n> * [x] another example\n- [ ] real task',
    'note.md',
  )
  assert.deepEqual(tasks.map(task => task.text), ['real task'])
})

test('task parser preserves genuinely nested task lists', () => {
  const tasks = parseTasksFromMarkdown(
    '- [ ] parent\n    - [/] child\n        + [x] grandchild',
    'note.md',
  )
  assert.deepEqual(tasks.map(task => task.text), ['parent', 'child', 'grandchild'])
})

test('task parser excludes tilde-fenced examples', () => {
  const tasks = parseTasksFromMarkdown('~~~text\n- [ ] example\n~~~\n- [ ] real', 'note.md')
  assert.deepEqual(tasks.map(task => task.text), ['real'])
})


test('task parser matches Rust dataview detection for rrule-only and priority-only fields', () => {
  const rruleOnly = parseTasksFromMarkdown('- [ ] recurring [rrule:: FREQ=WEEKLY]', 'note.md')[0]!
  assert.equal(rruleOnly.fieldStyle, 'dataview')
  assert.equal(rruleOnly.rrule, 'FREQ=WEEKLY')
  assert.equal(rruleOnly.text, 'recurring')

  const priorityOnly = parseTasksFromMarkdown('- [ ] urgent [priority:: -2]', 'note.md')[0]!
  assert.equal(priorityOnly.fieldStyle, 'dataview')
  assert.equal(priorityOnly.priority, -2)
  assert.equal(priorityOnly.text, 'urgent')
})

test('task parser preserves Rust priority semantics across parse and serialize', () => {
  const emoji = parseTasksFromMarkdown('- [/] investigate ⏫ 📅 2026-09-30 #work', 'note.md')[0]!
  assert.equal(emoji.priority, -2)
  assert.equal(emoji.fieldStyle, 'emoji')
  assert.equal(emoji.due, '2026-09-30')
  assert.match(serializeTask(emoji), /⏫/)
  assert.match(serializeTask(emoji), /📅 2026-09-30/)

  const dataview = parseTasksFromMarkdown(
    '- [x] ship [priority:: 2] [rrule:: FREQ=MONTHLY] #release',
    'note.md',
  )[0]!
  assert.equal(dataview.priority, 2)
  assert.equal(dataview.fieldStyle, 'dataview')
  assert.equal(dataview.rrule, 'FREQ=MONTHLY')
  assert.match(serializeTask(dataview), /\[priority:: 2\]/)
  assert.match(serializeTask(dataview), /\[rrule:: FREQ=MONTHLY\]/)
})
