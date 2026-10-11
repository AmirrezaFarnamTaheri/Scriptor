import assert from 'node:assert/strict'
import test from 'node:test'
import type { MermaidConfig } from 'mermaid'
import { renderMermaidDiagrams } from './mermaid-client.ts'
import {
  createMermaidPreviewRenderer,
  renderMermaidSvgWithLoader,
  type MermaidRuntime,
} from './mermaid-coordinator.ts'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>(done => { resolve = done })
  return { promise, resolve }
}

function runtimeFixture() {
  const original: MermaidConfig = {
    theme: 'dark', htmlLabels: true, secure: ['securityLevel', 'theme'],
    themeVariables: { primaryColor: '#123456' },
  }
  let config = structuredClone(original)
  let loads = 0
  const runtime: MermaidRuntime = {
    initialize(next) { config = { htmlLabels: true, ...structuredClone(next) } },
    mermaidAPI: { getSiteConfig: () => structuredClone(config) },
    async run() {},
    async render() { return { svg: '<svg />' } },
  }
  return {
    original, runtime,
    config: () => config,
    loads: () => loads,
    load: async () => { loads += 1; return runtime },
  }
}

test('preview waits until export completes and restores its configuration', async () => {
  const fixture = runtimeFixture()
  const started = deferred()
  const finish = deferred()
  const calls: string[] = []
  fixture.runtime.render = async (_id, source) => {
    calls.push('export')
    assert.equal(source, 'flowchart TD\nA --> B')
    assert.equal(fixture.config().htmlLabels, false)
    assert.ok(fixture.config().secure?.includes('htmlLabels'))
    assert.ok(fixture.config().secure?.includes('theme'))
    started.resolve()
    await finish.promise
    assert.equal(fixture.config().htmlLabels, false, 'preview cannot change a pending export')
    return { svg: '<svg>export</svg>' }
  }
  fixture.runtime.run = async () => {
    calls.push('preview')
    assert.equal(fixture.config().htmlLabels, true)
    assert.equal(fixture.config().theme, 'neutral')
    assert.equal(fixture.config().securityLevel, 'strict')
    assert.equal(fixture.config().secure?.includes('htmlLabels'), undefined)
  }
  const exported = renderMermaidSvgWithLoader('flowchart TD\nA --> B', fixture.load)
  await started.promise
  const preview = createMermaidPreviewRenderer(fixture.load).run({ nodes: [] })
  assert.deepEqual(calls, ['export'])
  assert.equal(fixture.loads(), 1, 'queued previews must not initialize or load Mermaid early')
  finish.resolve()
  assert.equal(await exported, '<svg>export</svg>')
  await preview
  assert.deepEqual(calls, ['export', 'preview'])
  assert.deepEqual(fixture.config(), fixture.original)
})

test('overlapping preview and multiple exports retain their own configuration for the whole render', async () => {
  const fixture = runtimeFixture()
  const started = deferred()
  const finish = deferred()
  const calls: string[] = []
  fixture.runtime.run = async () => {
    calls.push('preview')
    assert.equal(fixture.config().htmlLabels, true)
    started.resolve()
    await finish.promise
    assert.equal(fixture.config().htmlLabels, true, 'export cannot reconfigure a pending preview')
  }
  fixture.runtime.render = async (_id, source) => {
    calls.push(source)
    assert.equal(fixture.config().htmlLabels, false)
    assert.equal(fixture.config().startOnLoad, false)
    assert.ok(fixture.config().secure?.includes('htmlLabels'))
    assert.ok(fixture.config().secure?.includes('theme'))
    return { svg: `<svg>${source}</svg>` }
  }
  const preview = createMermaidPreviewRenderer(fixture.load).run({ nodes: [] })
  await started.promise
  const first = renderMermaidSvgWithLoader('first', fixture.load)
  const second = renderMermaidSvgWithLoader('second', fixture.load)
  assert.deepEqual(calls, ['preview'])
  finish.resolve()
  await preview
  assert.deepEqual(await Promise.all([first, second]), ['<svg>first</svg>', '<svg>second</svg>'])
  assert.deepEqual(calls, ['preview', 'first', 'second'])
  assert.deepEqual(fixture.config(), fixture.original)
})

test('a rejected export restores nested site settings and releases the queued preview', async () => {
  const fixture = runtimeFixture()
  const started = deferred()
  const finish = deferred()
  const failure = new Error('Invalid diagram')
  fixture.runtime.render = async () => {
    started.resolve()
    await finish.promise
    throw failure
  }
  let previewRan = false
  fixture.runtime.run = async () => {
    previewRan = true
    assert.equal(fixture.config().htmlLabels, true)
  }
  const rejected = assert.rejects(renderMermaidSvgWithLoader('broken', fixture.load), error => error === failure)
  await started.promise
  const preview = createMermaidPreviewRenderer(fixture.load).run({ nodes: [] })
  finish.resolve()
  await rejected
  await preview
  assert.equal(previewRan, true)
  assert.deepEqual(fixture.config(), fixture.original)
})

test('preview rejection restores configuration and does not poison the next export', async () => {
  const fixture = runtimeFixture()
  const failure = new Error('Preview parse failed')
  fixture.runtime.run = async () => { throw failure }
  await assert.rejects(createMermaidPreviewRenderer(fixture.load).run({ nodes: [] }), error => error === failure)
  assert.deepEqual(fixture.config(), fixture.original)
  assert.equal(await renderMermaidSvgWithLoader('valid', fixture.load), '<svg />')
  assert.deepEqual(fixture.config(), fixture.original)
})

test('initialization failure still restores configuration and releases the queue', async () => {
  const fixture = runtimeFixture()
  const initialize = fixture.runtime.initialize
  const failure = new Error('Initialization failed')
  fixture.runtime.initialize = config => {
    initialize(config)
    if (config.htmlLabels === false) throw failure
  }
  await assert.rejects(renderMermaidSvgWithLoader('valid', fixture.load), error => error === failure)
  assert.deepEqual(fixture.config(), fixture.original)
  await createMermaidPreviewRenderer(fixture.load).run({ nodes: [] })
  assert.deepEqual(fixture.config(), fixture.original)
})

test('a rejected lazy import does not prevent later Mermaid operations', async () => {
  const fixture = runtimeFixture()
  const failure = new Error('Module unavailable')
  await assert.rejects(renderMermaidSvgWithLoader('valid', async () => { throw failure }), error => error === failure)
  assert.equal(await renderMermaidSvgWithLoader('valid', fixture.load), '<svg />')
  assert.deepEqual(fixture.config(), fixture.original)
})

test('preview still accepts injected renderers that expose only run', async () => {
  const node = {
    classList: { contains: () => false },
    textContent: 'flowchart TD\nA --> B',
  } as unknown as HTMLElement
  const root = { querySelectorAll: () => [node] } as unknown as HTMLElement
  let calls = 0
  const result = await renderMermaidDiagrams(root, async () => ({
    async run(options) {
      assert.deepEqual(options.nodes, [node])
      calls += 1
    },
  }))
  assert.equal(calls, 1)
  assert.deepEqual(result, { rendered: 1, failed: 0 })
})
