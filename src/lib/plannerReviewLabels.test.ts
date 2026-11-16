import assert from 'node:assert/strict'
import test from 'node:test'
import { plannerReviewDirectionLabel } from './plannerReviewLabels.ts'

test('reconciliation suggestions distinguish local, provider and unresolved conflicts', () => {
  assert.match(plannerReviewDirectionLabel('pull','en'), /Google changed/)
  assert.match(plannerReviewDirectionLabel('push','en'), /Vault changed/)
  assert.match(plannerReviewDirectionLabel('conflict','en'), /Both copies/)
  assert.match(plannerReviewDirectionLabel('duplicate mapping','en'), /Multiple Google/)
  assert.match(plannerReviewDirectionLabel('missing event','en'), /missing/)
})
test('every possible review state is localized in English, German and Persian', () => {
  const states = ['create','pull','push','conflict','duplicate mapping','missing event','equal'] as const
  for (const language of ['en','de','fa'] as const) {
    for (const direction of states) {
      const text = plannerReviewDirectionLabel(direction,language)
      assert.ok(text.trim().length >= 12, `${language}: ${direction}`)
      assert.notEqual(text, direction)
    }
  }
})
