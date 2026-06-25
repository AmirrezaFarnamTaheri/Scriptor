import assert from 'node:assert/strict'
import { test } from 'node:test'

import { appendCitationExportArgs } from './citation-args.ts'
import { applyVaultExportToProfiles } from './vault-export.ts'
import {
  findDiagramBlocks,
  replaceDiagramBlocksWithImages,
  replaceDiagramBlocksWithPlaceholders,
} from './diagram-export.ts'
import { DEFAULT_EXPORT_PROFILES } from './profile.ts'
import { validateExportProfiles } from './schema.ts'

test('appendCitationExportArgs adds citeproc bibliography and csl', () => {
  const args = appendCitationExportArgs([], {
    bibliographyPath: 'references.bib',
    cslStylePath: 'apa-lite.csl',
  })
  assert.deepEqual(args, [
    '--citeproc',
    '--bibliography=references.bib',
    '--csl=apa-lite.csl',
  ])
})

test('appendCitationExportArgs preserves existing citeproc flag', () => {
  const args = appendCitationExportArgs(['--citeproc'], {
    bibliographyPath: 'refs.bib',
    cslStylePath: undefined,
  })
  assert.equal(args.filter((arg) => arg === '--citeproc').length, 1)
  assert.ok(args.includes('--bibliography=refs.bib'))
})

test('applyVaultExportToProfiles overrides bibliography and csl paths', () => {
  const profiles = applyVaultExportToProfiles(DEFAULT_EXPORT_PROFILES, {
    bibliography_path: 'library/refs.bib',
    csl_style_path: 'styles/chicago.csl',
  })
  const html = profiles.find((profile) => profile.id === 'html-standalone')
  assert.ok(html)
  assert.equal(html.bibliographyPath, 'library/refs.bib')
  assert.equal(html.cslStylePath, 'styles/chicago.csl')
})

test('validateExportProfiles accepts default profile set', () => {
  const errors = validateExportProfiles(DEFAULT_EXPORT_PROFILES)
  assert.deepEqual(errors, [])
})

test('default export profiles include reveal.js slides', () => {
  const slides = DEFAULT_EXPORT_PROFILES.find((profile) => profile.id === 'reveal-slides')
  assert.ok(slides)
  assert.equal(slides.format, 'html')
  assert.ok(slides.extraPandocArgs?.includes('-t'))
  assert.ok(slides.extraPandocArgs?.includes('revealjs'))
})

test('validateExportProfiles rejects traversal output directories', () => {
  const errors = validateExportProfiles([
    {
      ...DEFAULT_EXPORT_PROFILES[0]!,
      outputDirectory: '../outside',
    },
  ])
  assert.ok(errors.some((error) => error.includes('vault')))
})

test('validateExportProfiles accepts wechat-html format', () => {
  const errors = validateExportProfiles([
    {
      id: 'wechat-html-test',
      label: 'WeChat HTML',
      format: 'wechat-html',
      outputDirectory: '.scriptor/exports/wechat-html',
      extraPandocArgs: [],
    },
  ])
  assert.deepEqual(errors, [])
})

test('findDiagramBlocks collects mermaid and plantuml fences', () => {
  const markdown = '# Title\n\n```mermaid\ngraph LR\n  A-->B\n```\n\n```plantuml\n@startuml\nA->B\n@enduml\n```'
  const blocks = findDiagramBlocks(markdown)
  assert.equal(blocks.length, 2)
  assert.equal(blocks[0]?.kind, 'mermaid')
  assert.equal(blocks[1]?.kind, 'plantuml')
})

test('replaceDiagramBlocksWithImages uses render callback paths', async () => {
  const markdown = 'Intro\n\n```mermaid\ngraph TD\n  X\n```\n\nOutro'
  const result = await replaceDiagramBlocksWithImages(markdown, async (kind, _source, index) => {
    return `.scriptor/diagrams/${kind}-${index}.png`
  })
  assert.match(result.markdown, /!\[Mermaid diagram\]\(\.scriptor\/diagrams\/mermaid-0\.png\)/)
  assert.equal(result.diagrams.length, 1)
})

test('replaceDiagramBlocksWithPlaceholders inserts pending png refs', () => {
  const markdown = '```plantuml\n@startuml\n@enduml\n```'
  const next = replaceDiagramBlocksWithPlaceholders(markdown)
  assert.match(next, /diagram-plantuml-pending\.png/)
})

console.log('Export validation passed')
