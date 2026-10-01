import assert from 'node:assert/strict'
import test from 'node:test'
import { browseGuides, getGuide, helpCategory, HELP_GUIDES, searchAnswers, searchGuides } from './catalog.ts'
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
      assert.ok(!translation[field].includes(guide[field]), `${locale}:${guide.id}:${field} embeds English source`)
    }
    for (const [index, pair] of translation.steps.entries()) for (let column=0;column<2;column++) {
      assert.ok(pair[column]!.trim()); assert.notEqual(pair[column], guide.steps[index]![column], `${locale}:${guide.id} step ${index}`)
      assert.ok(!pair[column]!.includes(guide.steps[index]![column]!), `${locale}:${guide.id} step ${index} embeds English source`)
    }
    for (const [index, pair] of translation.questions.entries()) for (let column=0;column<2;column++) {
      assert.ok(pair[column]!.trim()); assert.notEqual(pair[column], guide.questions[index]![column], `${locale}:${guide.id} question ${index}`)
      assert.ok(!pair[column]!.includes(guide.questions[index]![column]!), `${locale}:${guide.id} question ${index} embeds English source`)
    }
  }
})

test('all 104 bundled guides have complete German and Persian bodies', () => {
  assert.equal(Object.keys(GUIDE_TRANSLATIONS).length,104)
  assert.equal(HELP_GUIDES.length,104)
  const unlocalized = HELP_GUIDES.filter(g => !GUIDE_TRANSLATIONS[g.id])
  assert.equal(unlocalized.length,0)
})

test('locale routing overlays every guide body while preserving targets and authority metadata', () => {
  for (const source of HELP_GUIDES) for (const locale of ['de', 'fa'] as const) {
    const translated = getGuide(source.id, locale)
    const body = GUIDE_TRANSLATIONS[source.id]![locale]
    for (const field of ['title', 'entry', 'prerequisite', 'safety', 'questions'] as const) assert.deepEqual(translated[field], body[field])
    for (const field of ['id', 'category', 'policy', 'source', 'roots', 'related', 'experimental'] as const) assert.deepEqual(translated[field], source[field])
    for (let index = 0; index < source.steps.length; index++) {
      assert.deepEqual(translated.steps[index]!.slice(0, 2), body.steps[index])
      assert.equal(translated.steps[index]![2], source.steps[index]![2])
    }
  }
  assert.equal(getGuide('help', 'unknown').title, getGuide('help').title)
})

test('localized search and direct answers use the selected corpus and canonical category filters', () => {
  for (const locale of ['de', 'fa'] as const) {
    for (const source of HELP_GUIDES) {
      const localized = getGuide(source.id, locale)
      assert.ok(searchGuides(localized.title, source.category, locale).some(hit => hit.id === source.id), `${locale}:${source.id} title search`)
      const question = localized.questions[0]![0]
      assert.ok(searchAnswers(question, source.category, locale).some(hit => hit.guide.id === source.id && hit.question === question), `${locale}:${source.id} answer search`)
    }
    assert.equal(browseGuides('help', '', '', locale)[0]!.title, getGuide('help', locale).title)
    assert.notEqual(helpCategory('Recovery', locale), 'Recovery')
  }
  assert.ok(searchGuides('پشتیبان', '', 'fa').some(hit => hit.id === 'backups'))
  assert.ok(searchGuides('Sicherung', '', 'de').some(hit => hit.id === 'backups'))
})
