import assert from 'node:assert/strict'
import { test } from 'node:test'

import { parseTasksFromMarkdown } from './taskParser.ts'

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
