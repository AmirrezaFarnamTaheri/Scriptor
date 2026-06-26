import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { test } from 'node:test'
import assert from 'node:assert/strict'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('bridge commands do not use removed headlessMode flag', () => {
  const commandsDir = path.join(rootDir, 'bridge', 'commands')
  for (const file of readdirSync(commandsDir)) {
    if (!file.endsWith('.ts')) continue
    const content = readFileSync(path.join(commandsDir, file), 'utf8')
    assert.equal(
      content.includes('headlessMode'),
      false,
      `${file} must route through set_headless_engine instead of headlessMode`,
    )
  }
})
