import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
const matrix = JSON.parse(readFileSync(new URL('./mutation-authority-matrix.json', import.meta.url), 'utf8'))
const catalog = readFileSync(new URL('../../crates/daemon/src/command_gateway/catalog.rs', import.meta.url), 'utf8')
const restricted = catalog.split('pub fn requires_desktop_authorization(command: &str) -> bool {')[1]?.split('\n}')[0]
const names = Array.from(restricted?.matchAll(/"([a-z0-9_]+)"/g) ?? [], match => match[1])
test('matrix enumerates the actual Rust daemon desktop-only catalog', () => {
  assert.ok(restricted)
  assert.deepEqual([...matrix.desktopOnly].sort(), names.sort())
  assert.equal(new Set(matrix.desktopOnly).size, matrix.desktopOnly.length)
})
test('every restricted operation documents denial and response-loss handling', () => {
  for (const name of matrix.desktopOnly) {
    const item = matrix.operations.find(entry => entry.command === name)
    assert.ok(item, `missing ${name}`)
    assert.equal(item.daemonPolicy, 'deny-without-desktop-authorization')
    assert.equal(item.authority, 'native')
    assert.ok(item.requiredFaults.includes('denied-before-mutation'))
    assert.ok(item.requiredFaults.includes('lost-native-reply'))
  }
})
test('matrix cannot pretend unverified entrypoints are supported', () => {
  assert.equal(new Set(matrix.operations.map(entry => entry.command)).size, matrix.operations.length)
  for (const item of matrix.operations) {
    assert.equal(item.evidence, 'pending')
    assert.ok(item.requiredFaults.includes('wrong-vault'))
    assert.ok(item.requiredFaults.includes('cancel-after-submission'))
  }
})
