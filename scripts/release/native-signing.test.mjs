import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { verifyNativeSigning } from './native-signing.mjs'

function fixture() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'scriptor-native-signing-'))
}

function touch(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, 'fixture')
}

test('Windows native signing verifies exactly the staged MSI and NSIS installer', () => {
  const root = fixture()
  touch(path.join(root, 'msi', 'Scriptor.msi'))
  touch(path.join(root, 'nsis', 'Scriptor-setup.exe'))
  touch(path.join(root, 'nsis', 'helper.dll'))
  const calls = []
  const result = verifyNativeSigning({
    platform: 'windows',
    bundleRoot: root,
    execute(command, args) {
      calls.push([command, args])
      return { status: 0, stdout: 'verified', stderr: '' }
    },
  })
  assert.equal(result.signed, true)
  assert.equal(result.notarized, false)
  assert.equal(result.signatureType, 'authenticode')
  assert.equal(calls.length, 2)
  assert.deepEqual(calls.map(([command]) => command), ['signtool', 'signtool'])
  assert.ok(calls.every(([, args]) => args.slice(0, 3).join(' ') === 'verify /pa /all'))
})

test('macOS native signing verifies Developer ID signature and stapled notarization ticket', () => {
  const root = fixture()
  fs.mkdirSync(path.join(root, 'macos', 'Scriptor.app'), { recursive: true })
  touch(path.join(root, 'dmg', 'Scriptor.dmg'))
  const calls = []
  const result = verifyNativeSigning({
    platform: 'macos',
    bundleRoot: root,
    execute(command, args) {
      calls.push([command, args])
      return { status: 0, stdout: 'verified', stderr: '' }
    },
  })
  assert.equal(result.signed, true)
  assert.equal(result.notarized, true)
  assert.equal(result.signatureType, 'developer-id')
  assert.deepEqual(calls.map(([command, args]) => [command, args[0]]), [
    ['codesign', '--verify'],
    ['spctl', '--assess'],
    ['xcrun', 'stapler'],
  ])
})

test('native signing verification fails closed on missing expected bundle subjects', () => {
  const root = fixture()
  assert.throws(
    () => verifyNativeSigning({ platform: 'windows', bundleRoot: root, execute() { throw new Error('must not run') } }),
    /missing Windows installer/,
  )
})
