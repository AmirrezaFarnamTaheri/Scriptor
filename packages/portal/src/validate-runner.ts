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

test('parseWorkspaceBundle reports corrupt payloads and returns defaults', () => {
  const corruptRaws: string[] = []
  const onCorrupt = (raw: string) => corruptRaws.push(raw)

  const invalidJson = parseWorkspaceBundle('{not json', { onCorrupt })
  assert.equal(invalidJson.portal.items.length, createWorkspaceBundle().portal.items.length)

  const badShape = '{"version":1,"portal":{"version":1,"items":42}}'
  const invalidShape = parseWorkspaceBundle(badShape, { onCorrupt })
  assert.ok(Array.isArray(invalidShape.portal.items))

  const badStickies = '{"version":1,"quickCapture":{"version":1,"stickies":[{"id":1}]}}'
  const invalidStickies = parseWorkspaceBundle(badStickies, { onCorrupt })
  assert.deepEqual(invalidStickies.quickCapture.stickies, [])

  assert.deepEqual(corruptRaws, ['{not json', badShape, badStickies])
})

test('parseWorkspaceBundle keeps valid payloads without reporting corruption', () => {
  let corruptCalls = 0
  const bundle = createWorkspaceBundle()
  const restored = parseWorkspaceBundle(serializeWorkspaceBundle(bundle), {
    onCorrupt: () => {
      corruptCalls += 1
    },
  })
  assert.equal(corruptCalls, 0)
  assert.equal(restored.version, 1)
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
