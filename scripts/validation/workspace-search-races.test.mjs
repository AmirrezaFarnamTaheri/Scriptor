import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import vm from 'node:vm'
import ts from 'typescript'

const source = ts.transpileModule(readFileSync(new URL('../../src/hooks/useSearchStore.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText

function harness() {
  const slots = []
  let cursor = 0
  let timer
  const pending = []
  let semanticCalls = 0
  class SemanticUnavailableError extends Error {}
  const react = {
    useState(initial) { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], (value) => { slots[i] = value }] },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial } },
    useCallback: (fn) => fn,
    useEffect() {},
  }
  const module = { exports: {} }
  vm.runInNewContext(source, {
    exports: module.exports, module, performance,
    window: { setTimeout: (fn) => { timer = fn; return 1 }, clearTimeout: () => { timer = null } },
    require: (id) => id === 'react' ? react : id.endsWith('/commands')
      ? { indexerSearch: () => new Promise((resolve) => pending.push(resolve)) }
      : id.endsWith('semantic.ts') ? { SemanticUnavailableError, semanticSearch: async () => { semanticCalls++; throw new SemanticUnavailableError() } }
        : { fuseKeywordAndSemantic: (hits) => hits },
  })
  return {
    render: () => { cursor = 0; return module.exports.useSearchStore() },
    pending,
    fireTimer: () => timer?.(),
    semanticCalls: () => semanticCalls,
  }
}

test('editing a query invalidates the previous request before debounce fires', async () => {
  const h = harness()
  const old = h.render().runSearch('old')
  h.render().setVaultSearchQuery('new')
  h.pending.shift()([{ path: 'old.md' }])
  await old
  assert.equal(h.render().searchResults.length, 0)
})

test('clearing search rearms the semantic capability for the next vault query', async () => {
  const h = harness()
  const first = h.render().runSearch('first')
  h.pending.shift()([])
  await first
  h.render().clearSearch()
  const second = h.render().runSearch('second')
  h.pending.shift()([])
  await second
  assert.equal(h.semanticCalls(), 2)
})
