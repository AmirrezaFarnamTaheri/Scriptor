import assert from 'node:assert/strict'
import test from 'node:test'
import { findDiagramBlocks, replaceDiagramBlocksWithImages, replaceDiagramBlocksWithPlaceholders } from './diagram-export.ts'
import { preprocessMarkdownDiagramsForExport, renderMermaidDiagramPng } from './diagram-render.ts'

const source = '# Authored source\n\n```plantuml\n@startuml\nAlice -> Bob: Hello\n@enduml\n```\n\nKeep this paragraph.\n'
const rendered = new TextEncoder().encode('<svg></svg>')

test('Mermaid SVG failure propagates before rasterization allocates an image', async () => {
  const failure = new Error('Invalid Mermaid source')
  await assert.rejects(renderMermaidDiagramPng('broken', async source => {
    assert.equal(source, 'broken')
    throw failure
  }), error => error === failure)
})

test('Mermaid rasterization uses the coordinated SVG and releases its object URL after success or failure', async t => {
  const source = 'flowchart TD\nA --> B'
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32"><text>A</text></svg>'
  const allocated: Blob[] = []
  const revoked: string[] = []
  const images: unknown[] = []
  const dimensions: [number, number][] = []
  let rasterFailure: Error | null = null
  let imageFailure = false
  const originalImage = Object.getOwnPropertyDescriptor(globalThis, 'Image')
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
  t.after(() => {
    if (originalImage) Object.defineProperty(globalThis, 'Image', originalImage)
    else Reflect.deleteProperty(globalThis, 'Image')
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument)
    else Reflect.deleteProperty(globalThis, 'document')
  })
  Object.defineProperty(globalThis, 'Image', {
    configurable: true,
    value: class {
      naturalWidth = 64
      naturalHeight = 32
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(url: string) {
        assert.equal(url, 'blob:mermaid-export')
        if (imageFailure) this.onerror?.()
        else this.onload?.()
      }
    },
  })
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      createElement(tag: string) {
        assert.equal(tag, 'canvas')
        return {
          width: 0,
          height: 0,
          getContext(kind: string) {
            assert.equal(kind, '2d')
            return { drawImage(image: unknown, x: number, y: number) {
              assert.deepEqual([x, y], [0, 0])
              images.push(image)
            } }
          },
          toDataURL(type: string) {
            assert.equal(type, 'image/png')
            dimensions.push([this.width, this.height])
            if (rasterFailure) throw rasterFailure
            return 'data:image/png;base64,cG5n'
          },
        }
      },
    },
  })
  t.mock.method(URL, 'createObjectURL', (blob: Blob) => {
    allocated.push(blob)
    return 'blob:mermaid-export'
  })
  t.mock.method(URL, 'revokeObjectURL', (url: string) => { revoked.push(url) })
  const renderSvg = async (authored: string) => {
    assert.equal(authored, source)
    return svg
  }
  assert.equal(await renderMermaidDiagramPng(source, renderSvg), 'data:image/png;base64,cG5n')
  assert.equal(allocated[0]?.type, 'image/svg+xml')
  assert.equal(await allocated[0]?.text(), svg)
  assert.deepEqual(dimensions, [[64, 32]])
  assert.equal(images.length, 1)
  assert.deepEqual(revoked, ['blob:mermaid-export'])

  rasterFailure = new Error('Rasterization failed')
  await assert.rejects(renderMermaidDiagramPng(source, renderSvg), error => error === rasterFailure)
  assert.deepEqual(revoked, ['blob:mermaid-export', 'blob:mermaid-export'])

  imageFailure = true
  await assert.rejects(renderMermaidDiagramPng(source, renderSvg), /Failed to load diagram image/)
  assert.equal(allocated.length, 3)
  assert.equal(revoked.length, 3, 'image decoding failures must also release the SVG URL')
})

test('diagram write failure stops preparation and preserves the authored source', async () => {
  const original = source
  let writes = 0
  let renders = 0
  await assert.rejects(
    preprocessMarkdownDiagramsForExport(source + source, async () => {
      writes += 1
      throw new Error('Asset already exists; choose another path')
    }, async () => {
      renders += 1
      return rendered
    }),
    /Could not prepare PlantUML diagram 1: Asset already exists; choose another path/,
  )
  assert.equal(writes, 1)
  assert.equal(renders, 1, 'the next diagram must not render after a failed write')
  assert.equal(source, original)
})

test('a cancelled renderer rejects instead of quietly exporting a code fence', async () => {
  let writes = 0
  const cancellation = new Error('Export cancelled')
  await assert.rejects(
    preprocessMarkdownDiagramsForExport(source, async () => { writes += 1; return 'assets/diagram.svg' }, async () => {
      throw cancellation
    }),
    error => {
      assert.ok(error instanceof Error)
      assert.match(error.message, /Could not prepare PlantUML diagram 1: Export cancelled/)
      assert.equal(error.cause, cancellation, 'preserve the original renderer error for diagnostics')
      return true
    },
  )
  assert.equal(writes, 0)
})

test('PlantUML preprocessing requires a renderer and does not invent a successful artifact', async () => {
  let writes = 0
  await assert.rejects(
    preprocessMarkdownDiagramsForExport(source, async () => { writes += 1; return 'assets/diagram.svg' }),
    /PlantUML diagram 1: A PlantUML renderer is required/,
  )
  assert.equal(writes, 0)
})

test('preprocessing encodes raw media filenames while keeping source text outside fences', async () => {
  const path = 'assets/Figures [draft] (1)#%?.svg'
  const input = source.replaceAll('\n', '\r\n')
  const result = await preprocessMarkdownDiagramsForExport(input, async (kind, index, bytes, extension) => {
    assert.equal(kind, 'plantuml')
    assert.equal(index, 0)
    assert.deepEqual(bytes, rendered)
    assert.equal(extension, 'svg')
    return path
  }, async () => rendered)
  assert.equal(result, '# Authored source\r\n\r\n![PlantUML diagram](assets/Figures%20%5Bdraft%5D%20%281%29%23%25%3F.svg)\r\n\r\nKeep this paragraph.\r\n')
  assert.equal(input, source.replaceAll('\n', '\r\n'))
})

test('the standalone diagram replacement safely represents raw file destinations', async () => {
  const path = 'assets/Diagram ](unsafe) [\'draft\'].svg'
  const result = await replaceDiagramBlocksWithImages(source, async () => path)
  assert.match(result.markdown, /!\[PlantUML diagram\]\(assets\/Diagram%20%5D%28unsafe%29%20%5B%27draft%27%5D\.svg\)/)
  assert.equal(result.diagrams[0]?.imagePath, path, 'metadata retains the file path, not its Markdown encoding')
})

test('replacement without a renderer creates actual comments rather than broken image destinations', async () => {
  const result = await replaceDiagramBlocksWithImages(source)
  assert.match(result.markdown, /<!-- scriptor:diagram:plantuml:0 -->/)
  assert.doesNotMatch(result.markdown, /!\[/)
  assert.deepEqual(result.diagrams, [], 'a placeholder is not a rendered image')
})

test('documents without diagram fences do not call renderers or writers', async () => {
  let calls = 0
  const markdown = '# Plain note\n\nA paragraph with an image: ![](assets/photo.png).\n'
  assert.equal(await preprocessMarkdownDiagramsForExport(markdown, async () => { calls += 1; return '' }, async () => { calls += 1; return rendered }), markdown)
  assert.deepEqual(await replaceDiagramBlocksWithImages(markdown, async () => { calls += 1; return '' }), { markdown, diagrams: [] })
  assert.equal(calls, 0)
})

test('backtick and tilde diagram fences remain executable across replacement APIs', async () => {
  const markdown = 'Before.\n\n```mermaid\nflowchart TD\nA --> B\n```\n\n~~~plantuml\n@startuml\nAlice -> Bob\n@enduml\n~~~\n\nAfter.\n'
  const blocks = findDiagramBlocks(markdown)
  assert.deepEqual(blocks.map(block => block.kind), ['mermaid', 'plantuml'])
  assert.equal(blocks[0]?.source, 'flowchart TD\nA --> B')
  assert.equal(blocks[1]?.source, '@startuml\nAlice -> Bob\n@enduml')
  const renderedKinds: string[] = []
  const replaced = await replaceDiagramBlocksWithImages(markdown, (kind, _source, index) => {
    renderedKinds.push(kind)
    return `assets/${kind}-${index}.png`
  })
  assert.deepEqual(renderedKinds, ['mermaid', 'plantuml'])
  assert.match(replaced.markdown, /!\[Mermaid diagram\]\(assets\/mermaid-0\.png\)/)
  assert.match(replaced.markdown, /!\[PlantUML diagram\]\(assets\/plantuml-1\.png\)/)
  assert.match(replaceDiagramBlocksWithPlaceholders(markdown), /diagram-plantuml-pending\.png/)
  assert.equal(replaced.diagrams.length, 2)
})

test('shorter nested examples inside longer fences stay authored code instead of rendering', async () => {
  const example = '````markdown\n```mermaid\nflowchart TD\nA --> B\n```\n~~~plantuml\n@startuml\nAlice -> Bob\n@enduml\n~~~\n````\n'
  const tildeExample = '~~~~~markdown\n~~~mermaid\nflowchart TD\nC --> D\n~~~\n~~~~~\n'
  const actual = '~~~plantuml\n@startuml\nBob -> Carol\n@enduml\n~~~\n'
  const markdown = `${example}\n${tildeExample}\n${actual}`
  assert.deepEqual(findDiagramBlocks(markdown).map(block => block.source), ['@startuml\nBob -> Carol\n@enduml'])
  let calls = 0
  const replaced = await replaceDiagramBlocksWithImages(markdown, () => { calls += 1; return 'assets/actual.svg' })
  assert.equal(calls, 1)
  assert.ok(replaced.markdown.startsWith(`${example}\n${tildeExample}\n`))
  assert.ok(replaceDiagramBlocksWithPlaceholders(markdown).startsWith(`${example}\n${tildeExample}\n`))
  const prepared = await preprocessMarkdownDiagramsForExport(markdown, async () => 'assets/actual.svg', async () => rendered)
  assert.ok(prepared.startsWith(`${example}\n${tildeExample}\n`))
  assert.match(prepared, /!\[PlantUML diagram\]\(assets\/actual\.svg\)/)
})

test('opening and closing fences obey line anchors, indentation, delimiter and suffix rules', () => {
  assert.deepEqual(findDiagramBlocks('Text ```mermaid\nflowchart TD\nA --> B\n```\n'), [])
  assert.deepEqual(findDiagramBlocks('    ```mermaid\n    flowchart TD\n    A --> B\n    ```\n'), [])
  assert.deepEqual(findDiagramBlocks('```mermaid `invalid-info`\nflowchart TD\n```\n'), [])
  const markdown = '   ````MERMAID {#chart}\r\nflowchart TD\r\nA --> B\r\n```\r\n~~~\r\n```` trailing text\r\n   ````` \t\r\nAfter.\r\n'
  const blocks = findDiagramBlocks(markdown)
  assert.equal(blocks.length, 1)
  assert.equal(blocks[0]?.kind, 'mermaid')
  assert.equal(blocks[0]?.source, 'flowchart TD\nA --> B\n```\n~~~\n```` trailing text')
  assert.equal(markdown.slice(blocks[0]!.start, blocks[0]!.end), markdown.slice(3, markdown.indexOf('\r\nAfter.')))
})

test('an unterminated diagram fence extends to document end while empty fences remain untouched', () => {
  const markdown = '~~~mermaid\nflowchart TD\nA --> B'
  assert.deepEqual(findDiagramBlocks(markdown), [{ kind: 'mermaid', source: 'flowchart TD\nA --> B', start: 0, end: markdown.length }])
  assert.deepEqual(findDiagramBlocks('~~~mermaid\n \n~~~\n'), [])
  assert.equal(replaceDiagramBlocksWithPlaceholders('~~~mermaid\n \n~~~\n'), '~~~mermaid\n \n~~~\n')
})

test('two- and four-space list diagrams render without moving their images outside the list', async () => {
  for (const prefix of ['  ', '    ']) {
    const markdown = `- Diagram:\n\n${prefix}\`\`\`plantuml\n${prefix}@startuml\n${prefix}Alice -> Bob\n${prefix}@enduml\n${prefix}\`\`\`\n\nAfter.\n`
    const blocks = findDiagramBlocks(markdown)
    assert.equal(blocks.length, 1, `the ${prefix.length}-space list fence must remain executable`)
    assert.equal(blocks[0]?.source, '@startuml\nAlice -> Bob\n@enduml')
    assert.equal(markdown.slice(0, blocks[0]!.start), `- Diagram:\n\n${prefix}`)
    const result = await replaceDiagramBlocksWithImages(markdown, () => 'assets/list.svg')
    assert.equal(result.markdown, `- Diagram:\n\n${prefix}![PlantUML diagram](assets/list.svg)\n\nAfter.\n`)
    const prepared = await preprocessMarkdownDiagramsForExport(markdown, async () => 'assets/list.svg', async code => {
      assert.equal(code, '@startuml\nAlice -> Bob\n@enduml')
      return rendered
    })
    assert.ok(prepared.startsWith(`- Diagram:\n\n${prefix}![PlantUML diagram](assets/list.svg)`))
  }
})

test('quoted diagrams and nested quoted list diagrams keep their container prefixes', async () => {
  const cases = [
    { before: '> ', rest: '> @startuml\n> Alice -> Bob\n> @enduml\n> ~~~\n' },
    { before: '> - Diagram:\n>\n>   ', rest: '>   @startuml\n>   Alice -> Bob\n>   @enduml\n>   ~~~\n' },
    { before: '> > - Diagram:\n> >\n> >     ', rest: '> >     @startuml\n> >     Alice -> Bob\n> >     @enduml\n> >     ~~~\n' },
  ]
  for (const example of cases) {
    const markdown = `${example.before}~~~plantuml\n${example.rest}`
    const blocks = findDiagramBlocks(markdown)
    assert.equal(blocks.length, 1)
    assert.equal(blocks[0]?.source, '@startuml\nAlice -> Bob\n@enduml')
    const result = await replaceDiagramBlocksWithImages(markdown, () => 'assets/quoted.svg')
    assert.equal(result.markdown, `${example.before}![PlantUML diagram](assets/quoted.svg)\n`)
    const prepared = await preprocessMarkdownDiagramsForExport(markdown, async () => 'assets/quoted.svg', async () => rendered)
    assert.equal(prepared, `${example.before}![PlantUML diagram](assets/quoted.svg)\n`)
    assert.equal(replaceDiagramBlocksWithPlaceholders(markdown), `${example.before}![PlantUML diagram](diagram-plantuml-pending.png)\n`)
  }
})

test('literal indented and container-nested longer examples never execute their shorter diagrams', async () => {
  const indented = '    ```mermaid\n    flowchart TD\n    A --> B\n    ```\n'
  const quoted = '> ````markdown\n> ```mermaid\n> flowchart TD\n> A --> B\n> ```\n> ````\n'
  const listExample = '- Example:\n\n    ~~~~~markdown\n    ~~~plantuml\n    @startuml\n    Alice -> Bob\n    @enduml\n    ~~~\n    ~~~~~\n'
  for (const markdown of [indented, quoted, listExample]) {
    assert.deepEqual(findDiagramBlocks(markdown), [])
    let calls = 0
    assert.deepEqual(await replaceDiagramBlocksWithImages(markdown, () => { calls += 1; return 'assets/unexpected.svg' }), { markdown, diagrams: [] })
    assert.equal(replaceDiagramBlocksWithPlaceholders(markdown), markdown)
    assert.equal(calls, 0)
  }
})

test('a diagram opened on the list item line keeps the authored item marker', async () => {
  const markdown = '- ```plantuml\n  @startuml\n  Alice -> Bob\n  @enduml\n  ```\n'
  const result = await replaceDiagramBlocksWithImages(markdown, () => 'assets/item.svg')
  assert.equal(result.markdown, '- ![PlantUML diagram](assets/item.svg)\n')
  assert.equal(result.diagrams[0]?.source, '@startuml\nAlice -> Bob\n@enduml')
})
