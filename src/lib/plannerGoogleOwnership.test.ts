import assert from 'node:assert/strict'
import { test } from 'node:test'
import { plannerGoogleTaskBaseKey, readGoogleOwnedPlannerBlocks, serializeGoogleOwnedPlannerBlocks } from './plannerGoogleOwnership.ts'

const local = { taskId: 'task-1', title: 'Keep local schedule', start: '2026-10-09T09:00:00Z', end: '2026-10-09T10:00:00Z' }
const linked = { ...local, eventId: 'provider-event', base: { title: 'Prior event', start: local.start, end: local.end } }
test('confirmed account and calendar preserve their own event mapping across restart', () => {
  const owner = { account: 'FIRST@example.com', calendarId: 'primary' }
  const raw = serializeGoogleOwnedPlannerBlocks([linked], owner)
  assert.deepEqual(readGoogleOwnedPlannerBlocks(raw, { ...owner, account: 'first@example.com' }), [linked])
})
test('legacy and other-account calendar mappings cannot transfer provider IDs but retain local schedules', () => {
  const first = { account: 'first@example.com', calendarId: 'primary' }
  const raw = serializeGoogleOwnedPlannerBlocks([linked], first)
  for (const owner of [null, { ...first, account: 'second@example.com' }, { ...first, calendarId: 'another-calendar' }]) {
    assert.deepEqual(readGoogleOwnedPlannerBlocks(raw, owner), [local])
  }
  assert.deepEqual(readGoogleOwnedPlannerBlocks(JSON.stringify([linked]), first), [local])
  assert.deepEqual(readGoogleOwnedPlannerBlocks(serializeGoogleOwnedPlannerBlocks([linked], null), first), [local])
})
test('default task-list aliases isolate baseline snapshots by confirmed account and vault', () => {
  const key = plannerGoogleTaskBaseKey('vault', 'first@example.com', '@default')
  assert.notEqual(key, plannerGoogleTaskBaseKey('vault', 'second@example.com', '@default'))
  assert.notEqual(key, plannerGoogleTaskBaseKey('another-vault', 'first@example.com', '@default'))
  assert.notEqual(key, plannerGoogleTaskBaseKey('vault', null, '@default'))
  assert.notEqual(key, plannerGoogleTaskBaseKey('vault', 'first@example.com', 'another-list'))
})
