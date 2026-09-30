import assert from 'node:assert/strict'
import test from 'node:test'
import { HELP_GUIDES } from './catalog.ts'
import { GUIDE_TRANSLATIONS } from './translations.ts'

test('authored German and Persian guide bodies retain all fields and structural counts', () => {
  const source = new Map(HELP_GUIDES.map(g => [g.id,g]))
  for (const [id, translations] of Object.entries(GUIDE_TRANSLATIONS)) for (const locale of ['de','fa'] as const) {
    const guide = source.get(id)
    assert.ok(guide, `unknown translated guide: ${id}`)
    const translation = translations[locale]
    assert.equal(translation.steps.length, guide.steps.length, `${locale}:${guide.id} steps`)
    assert.equal(translation.questions.length, guide.questions.length, `${locale}:${guide.id} questions`)
    for (const field of ['title','entry','prerequisite','safety'] as const) {
      assert.ok(translation[field].trim(), `${locale}:${guide.id}:${field}`)
      assert.notEqual(translation[field], guide[field], `${locale}:${guide.id}:${field} is untranslated`)
    }
    for (const [index, pair] of translation.steps.entries()) for (let column=0;column<2;column++) {
      assert.ok(pair[column]!.trim()); assert.notEqual(pair[column], guide.steps[index]![column], `${locale}:${guide.id} step ${index}`)
    }
    for (const [index, pair] of translation.questions.entries()) for (let column=0;column<2;column++) {
      assert.ok(pair[column]!.trim()); assert.notEqual(pair[column], guide.questions[index]![column], `${locale}:${guide.id} question ${index}`)
    }
  }
})

test('the current translation batch explicitly covers 41 of 104 guides', () => {
  assert.equal(Object.keys(GUIDE_TRANSLATIONS).length,41)
  assert.equal(HELP_GUIDES.length,104)
  const unlocalized = HELP_GUIDES.filter(g => !GUIDE_TRANSLATIONS[g.id])
  assert.equal(unlocalized.length,63)
})
