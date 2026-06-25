import assert from 'node:assert/strict'
import { test } from 'node:test'

import { parseShortcut, shortcutMatches } from './shortcuts.ts'
import { createWorkspaceBundle, parseWorkspaceBundle, serializeWorkspaceBundle } from './storage.ts'

test('parseShortcut reads mod+shift+key', () => {
  const parsed = parseShortcut('mod+shift+1')
  assert.ok(parsed)
  assert.equal(parsed.mod, true)
  assert.equal(parsed.shift, true)
  assert.equal(parsed.key, '1')
})

test('workspace bundle roundtrips', () => {
  const bundle = createWorkspaceBundle()
  bundle.portal.items.push({
    id: 'test',
    categoryId: 'custom',
    title: 'Test',
    body: 'Hello',
    action: 'copy',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  })
  const restored = parseWorkspaceBundle(serializeWorkspaceBundle(bundle))
  assert.equal(restored.portal.items.length, bundle.portal.items.length)
})

test('shortcutMatches detects combo', () => {
  const parsed = parseShortcut('mod+shift+p')
  assert.ok(parsed)
  const isMac = process.platform === 'darwin'
  const event = {
    key: 'p',
    metaKey: isMac,
    ctrlKey: !isMac,
    shiftKey: true,
    altKey: false,
  } as KeyboardEvent
  assert.equal(shortcutMatches(event, parsed), true)
})

console.log('Portal validation passed')
