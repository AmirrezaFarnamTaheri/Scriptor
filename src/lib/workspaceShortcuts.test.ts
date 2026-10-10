import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { defaultWorkspaceShortcutPreferences, getWorkspaceShortcutItems, parseWorkspaceShortcutPreferences } from './workspaceShortcuts.ts'

describe('workspace shortcut preferences', () => {
  it('starts with only the three writing shortcuts and does not pin new integrations automatically', () => {
    const items = getWorkspaceShortcutItems(defaultWorkspaceShortcutPreferences(), ['writing', 'source', 'preview', 'open-runtime-console'])
    assert.deepEqual(items.filter(item => item.shown && item.pinned).map(item => item.id), ['writing', 'source', 'preview'])
    assert.equal(items.find(item => item.id === 'open-runtime-console')?.shown, false)
  })

  it('restores hidden state, labels, order, pinning and sizes without interpreting labels as markup', () => {
    const saved = { version: 1, visible: false, items: [
      { id: 'source', shown: true, pinned: false, label: '<Code>', width: 160, fontSize: 14 },
      { id: 'writing', shown: false, pinned: true, label: '', width: 0, fontSize: 12 },
    ] }
    assert.deepEqual(parseWorkspaceShortcutPreferences(JSON.stringify(saved)), saved)
    assert.deepEqual(getWorkspaceShortcutItems(parseWorkspaceShortcutPreferences(JSON.stringify(saved)), ['writing', 'source']).map(item => item.id), ['source', 'writing'])
  })

  it('rejects malformed, unsupported and oversized storage with compact recoverable defaults', () => {
    for (const raw of ['{', '{"version":2}', JSON.stringify({ version: 1, visible: 'false' }), ' '.repeat(65_537)]) {
      assert.deepEqual(parseWorkspaceShortcutPreferences(raw), defaultWorkspaceShortcutPreferences())
    }
  })

  it('bounds dimensions, deduplicates IDs and retains unavailable plugin settings', () => {
    const saved = { version: 1, visible: true, items: [
      { id: 'workspace:plugin:view', shown: true, pinned: true, label: 'a'.repeat(200), width: 99_999, fontSize: -2 },
      { id: 'workspace:plugin:view', shown: false },
      { id: '../bad', shown: true },
    ] }
    const restored = parseWorkspaceShortcutPreferences(JSON.stringify(saved))
    assert.equal(restored.items.length, 1)
    assert.equal(restored.items[0].width, 320)
    assert.equal(restored.items[0].fontSize, 11)
    assert.equal(restored.items[0].label.length, 80)
    assert.equal(getWorkspaceShortcutItems(restored, ['writing']).length, 1)
    assert.equal(restored.items[0].id, 'workspace:plugin:view')
  })

  it('caps storage and command catalogs and defaults nonfinite dimensions', () => {
    const ids = Array.from({ length: 150 }, (_, index) => `workspace-${index}`)
    const restored = parseWorkspaceShortcutPreferences(JSON.stringify({ version: 1, visible: true, items: ids.map(id => ({ id, shown: true, width: 0, fontSize: 12 })) }))
    assert.equal(restored.items.length, 128)
    assert.equal(getWorkspaceShortcutItems(defaultWorkspaceShortcutPreferences(), ids).length, 128)
    // JSON can express numbers that overflow to Infinity when parsed.
    const overflow = parseWorkspaceShortcutPreferences('{"version":1,"visible":true,"items":[{"id":"source","width":1e400,"fontSize":-1e400}]}')
    assert.equal(overflow.items[0].width, 0)
    assert.equal(overflow.items[0].fontSize, 12)
  })
})
