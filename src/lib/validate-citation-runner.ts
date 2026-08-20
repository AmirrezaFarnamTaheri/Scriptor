import assert from 'node:assert/strict'
import { test } from 'node:test'

import { extractPandocCitationKeys } from './citationExtract.ts'
import { bibliographyEntryToCslItem, mapBibliographyEntryType } from './bibliographyToCsl.ts'
import {
  CITATION_PLUGIN_CAPABILITY_ID,
  CITATION_PLUGIN_ID,
  citationsPluginManifest,
  isCitationsPluginEnabled,
} from '../components/inspector/citation-plugin-manifest.ts'

test('extracts multiple bracket citations', () => {
  assert.deepEqual(extractPandocCitationKeys('Blah blah [@doe99; @smith2000; @smith2004].'), [
    'doe99',
    'smith2000',
    'smith2004',
  ])
})

test('extracts citations with prefix and locator', () => {
  const keys = extractPandocCitationKeys('Blah blah [see @doe99, pp. 33-35 and *passim*; @smith04, chap. 1].')
  assert.ok(keys.includes('doe99'))
  assert.ok(keys.includes('smith04'))
})

test('extracts braced url citekey', () => {
  assert.deepEqual(
    extractPandocCitationKeys('[@{https://example.com/bib?name=foobar&date=2000}, p. 33]'),
    ['https://example.com/bib?name=foobar&date=2000'],
  )
})

test('extracts suppress author inline', () => {
  assert.deepEqual(extractPandocCitationKeys('As shown by -@smith04.'), ['smith04'])
})

test('extracts simple bracket and inline', () => {
  assert.deepEqual(extractPandocCitationKeys('Text [@key] and @inline.'), ['key', 'inline'])
})

test('maps bibliography entry types for citeproc', () => {
  assert.equal(mapBibliographyEntryType('book'), 'book')
  assert.equal(mapBibliographyEntryType('article'), 'article-journal')
})

test('builds CSL JSON items from bibliography rows', () => {
  const item = bibliographyEntryToCslItem({
    key: 'smith2024',
    title: 'Example',
    source_path: 'refs.bib',
    entry_type: 'article',
    author: 'Smith, Jane',
    year: '2024',
  })
  assert.equal(item.id, 'smith2024')
  assert.deepEqual(item.issued, { 'date-parts': [[2024]] })
})

test('validates citations plugin capability manifest structure', () => {
  assert.equal(citationsPluginManifest.id, CITATION_PLUGIN_ID)
  assert.equal(citationsPluginManifest.capabilityId, CITATION_PLUGIN_CAPABILITY_ID)
  assert.equal(citationsPluginManifest.rustFeatureGate, 'scriptor-indexer')
  assert.ok(citationsPluginManifest.contributes?.inspectorWidgets?.some((w) => w.id === 'citation-inspector'))
  assert.ok(citationsPluginManifest.contributes?.commands?.some((c) => c.commandId === 'citations.insert'))
  assert.equal(citationsPluginManifest.contributes?.commands?.some((c) => c.commandId === 'citations.sync'), false)
})

test('checks citations plugin enablement correctly', () => {
  assert.equal(isCitationsPluginEnabled(['scriptor.citations']), true)
  assert.equal(isCitationsPluginEnabled(['citations']), true)
  assert.equal(isCitationsPluginEnabled(['scriptor.canvas']), false)
  assert.equal(isCitationsPluginEnabled([]), false)
})
