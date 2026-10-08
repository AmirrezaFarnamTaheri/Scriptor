import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const source = ts.transpileModule(readFileSync(new URL('../../src/hooks/useCommandPalette.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

function harness(modals = []) {
  let open = false
  const listeners = []
  const effects = []
  const module = { exports: {} }
  vm.runInNewContext(source, {
    module, exports: module.exports,
    document: { querySelectorAll: () => modals },
    window: {
      addEventListener(type, listener, capture) { listeners.push({ type, listener, capture }) },
      removeEventListener(type, listener, capture) {
        const index = listeners.findIndex(entry => entry.type === type && entry.listener === listener && entry.capture === capture)
        if (index >= 0) listeners.splice(index, 1)
      },
    },
    require: () => ({
      useState: () => [open, value => { open = value }],
      useRef: () => ({ current: null }),
      useEffect: effect => effects.push(effect),
    }),
  })
  module.exports.useCommandPalette()
  const cleanups = effects.map(effect => effect()).filter(Boolean)
  function press(changes = {}) {
    const event = {
      key: 'k', ctrlKey: true, metaKey: false, altKey: false, shiftKey: false,
      isComposing: false, keyCode: 75,
      prevented: false, stopped: false,
      preventDefault() { this.prevented = true },
      stopPropagation() { this.stopped = true },
      ...changes,
    }
    listeners.filter(entry => entry.capture).forEach(entry => entry.listener(event))
    // A focused editor's bubbling handler would stop this event. The global
    // capture handler must have opened the palette before it reaches that editor.
    const editorReceivedChord = !event.stopped
    return { event, editorReceivedChord, open }
  }
  return { press, listeners, cleanup: () => cleanups.forEach(cleanup => cleanup()) }
}

test('palette chord reaches the global capture handler before a focused editor and unregisters symmetrically', () => {
  const h = harness()
  const result = h.press()
  assert.equal(result.open, true)
  assert.equal(result.event.prevented, true)
  assert.equal(result.editorReceivedChord, false)
  h.cleanup()
  assert.equal(h.listeners.length, 0)
})

test('Cmd+K opens the palette; composition and other modified chords retain editor ownership', () => {
  assert.equal(harness().press({ ctrlKey: false, metaKey: true }).open, true)
  for (const changes of [{ isComposing: true }, { keyCode: 229 }, { altKey: true }, { shiftKey: true }, { key: 'b' }]) {
    const result = harness().press(changes)
    assert.equal(result.open, false)
    assert.equal(result.event.prevented, false)
    assert.equal(result.editorReceivedChord, true)
  }
})

test('visible modal forms block palette opening but hidden forms and the palette itself do not', () => {
  const modal = (visible, palette) => ({
    getClientRects: () => visible ? [{}] : [],
    classList: { contains: name => palette && name === 'command-palette-overlay' },
  })
  assert.equal(harness([modal(true, false)]).press().open, false)
  assert.equal(harness([modal(false, false)]).press().open, true)
  assert.equal(harness([modal(true, true)]).press().open, true)
})
