import assert from 'node:assert/strict'
import test from 'node:test'
import { PROFILES, GITHUB_RELEASE_BASE_URL } from './installer-profiles.mjs'

test('PROFILES contains all 7 preset profiles', () => {
  assert.ok(PROFILES.focused)
  assert.ok(PROFILES.minimal)
  assert.ok(PROFILES.writer)
  assert.ok(PROFILES.scientific)
  assert.ok(PROFILES.researcher)
  assert.ok(PROFILES.developer)
  assert.ok(PROFILES.complete)

  assert.deepEqual(PROFILES.focused.plugins, [])
  assert.deepEqual(PROFILES.minimal.plugins, ['scriptor.export'])
  assert.deepEqual(PROFILES.writer.plugins, ['scriptor.export', 'scriptor.canvas'])
  assert.deepEqual(PROFILES.scientific.plugins, ['scriptor.export', 'scriptor.citations', 'scriptor.graph'])
  assert.deepEqual(PROFILES.researcher.plugins, ['scriptor.export', 'scriptor.graph', 'scriptor.mcp'])
  assert.deepEqual(PROFILES.developer.plugins, ['scriptor.export', 'scriptor.graph', 'scriptor.canvas', 'scriptor.mcp'])
  assert.equal(PROFILES.complete.plugins.length, 5)
})

test('lightweight profiles use local download source', () => {
  assert.equal(PROFILES.focused.downloadSource, 'local')
  assert.equal(PROFILES.minimal.downloadSource, 'local')
})

test('all profiles with native plugins use github-release source', () => {
  const ghProfiles = ['writer', 'scientific', 'researcher', 'developer', 'complete']
  for (const key of ghProfiles) {
    assert.equal(
      PROFILES[key].downloadSource,
      'github-release',
      `${key} should use github-release`,
    )
    assert.ok(
      PROFILES[key].githubReleaseUrl?.startsWith('https://github.com/'),
      `${key}.githubReleaseUrl should be a GitHub URL`,
    )
  }
})

test('GITHUB_RELEASE_BASE_URL is exported and non-empty', () => {
  assert.ok(typeof GITHUB_RELEASE_BASE_URL === 'string')
  assert.ok(GITHUB_RELEASE_BASE_URL.length > 0)
})
