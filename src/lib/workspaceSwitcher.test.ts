import assert from 'node:assert/strict'
import test from 'node:test'
import { getVaultLabel, getDisambiguatedVaultLabels } from './workspaceSwitcher.ts'

test('getVaultLabel returns basename of vault path', () => {
  assert.equal(getVaultLabel('/home/user/vaults/personal'), 'personal')
  assert.equal(getVaultLabel('C:\\Users\\ACER\\Documents\\Notes'), 'Notes')
  assert.equal(getVaultLabel('standalone'), 'standalone')
})

test('getDisambiguatedVaultLabels returns basenames when there are no collisions', () => {
  const vaults = ['/work/project-a', '/personal/journal', '/research/papers']
  const labels = getDisambiguatedVaultLabels(vaults)
  assert.equal(labels.get('/work/project-a'), 'project-a')
  assert.equal(labels.get('/personal/journal'), 'journal')
  assert.equal(labels.get('/research/papers'), 'papers')
})

test('getDisambiguatedVaultLabels disambiguates colliding basenames with parent directory', () => {
  const vaults = ['/work/client', '/archive/client', '/docs/notes']
  const labels = getDisambiguatedVaultLabels(vaults)
  assert.equal(labels.get('/work/client'), 'work/client')
  assert.equal(labels.get('/archive/client'), 'archive/client')
  assert.equal(labels.get('/docs/notes'), 'notes')
})

test('getDisambiguatedVaultLabels disambiguates deeper collisions', () => {
  const vaults = [
    '/team-1/subteam/project',
    '/team-2/subteam/project',
  ]
  const labels = getDisambiguatedVaultLabels(vaults)
  assert.equal(labels.get('/team-1/subteam/project'), 'team-1/subteam/project')
  assert.equal(labels.get('/team-2/subteam/project'), 'team-2/subteam/project')
})
