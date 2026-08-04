import assert from 'node:assert/strict'
import test from 'node:test'

import { npmPurl, parseCargoLockPackages, parsePnpmLockPackages } from './sbom-utils.mjs'

test('npmPurl preserves scoped namespace structure', () => {
  assert.equal(npmPurl('@scope/package', '1.2.3'), 'pkg:npm/%40scope/package@1.2.3')
})

test('parsePnpmLockPackages emits resolved versions and lockfile hashes', () => {
  const components = parsePnpmLockPackages(`lockfileVersion: '9.0'\n\npackages:\n\n  '@scope/package@1.2.3':\n    resolution: {integrity: sha512-YQ==}\n\n  plain@2.0.0:\n    resolution: {integrity: sha512-Yg==}\n\nsnapshots:\n`)
  assert.deepEqual(components.map(({ name, version }) => ({ name, version })), [
    { name: '@scope/package', version: '1.2.3' },
    { name: 'plain', version: '2.0.0' },
  ])
  assert.equal(components[0].hashes[0].alg, 'SHA-512')
  assert.equal(components[0].hashes[0].content, '61')
})

test('parseCargoLockPackages emits checksum-backed resolved components', () => {
  const [component] = parseCargoLockPackages(`version = 4\n\n[[package]]\nname = "crate-name"\nversion = "3.4.5"\nchecksum = "${'a'.repeat(64)}"\n`)
  assert.equal(component.purl, 'pkg:cargo/crate-name@3.4.5')
  assert.deepEqual(component.hashes, [{ alg: 'SHA-256', content: 'a'.repeat(64) }])
})
