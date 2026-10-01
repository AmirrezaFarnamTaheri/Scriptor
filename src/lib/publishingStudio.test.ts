import assert from 'node:assert/strict'
import test from 'node:test'
import { publicationRows, validateDeploymentTarget, redactPublishingLog } from './publishingStudio.ts'

test('publication matrix derives eligibility only from the reviewed native plan', () => {
  const rows = publicationRows([{path:'private.md',title:'Private'},{path:'public.md',title:'Public'}], {new_items:[{rel_path:'public.md',content_hash:'abc'}],changed:[],unchanged:[],orphaned:['old.md']})
  assert.equal(rows[0].eligible, false)
  assert.equal(rows[1].eligible, true)
  assert.equal(rows[1].contentHash, 'abc')
})
test('deployment targets cannot inject arguments, URLs, or account paths', () => {
  assert.deepEqual(validateDeploymentTarget({accountId:'a'.repeat(32),project:'research-notes',domain:'notes.example.org'}), {accountId:'a'.repeat(32),project:'research-notes',domain:'notes.example.org'})
  for (const project of ['--help','x/y','name;command','']) assert.throws(() => validateDeploymentTarget({accountId:'a'.repeat(32),project,domain:''}))
  assert.throws(() => validateDeploymentTarget({accountId:'../',project:'notes',domain:''}))
  assert.throws(() => validateDeploymentTarget({accountId:'a'.repeat(32),project:'notes',domain:'https://example.org/path'}))
})
test('credential material is removed from bounded display logs', () => {
  assert.equal(redactPublishingLog('Failure for secret-token', 'secret-token'), 'Failure for [redacted]')
  assert.ok(redactPublishingLog('x'.repeat(300000), '').length <= 262144)
})
