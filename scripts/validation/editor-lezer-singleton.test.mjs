import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = path.resolve(import.meta.dirname, '../..')

test('the Markdown parser, CodeMirror and highlighter share one Lezer core', () => {
  const workspace = fs.readFileSync(path.join(root, 'pnpm-workspace.yaml'), 'utf8')
  const lock = fs.readFileSync(path.join(root, 'pnpm-lock.yaml'), 'utf8')
  assert.match(workspace, /^ {2}["']?@lezer\/common["']?: ["']1\.5\.3["']$/m)

  // The package and snapshot entries must resolve to exactly one runtime
  // version, otherwise differing NodeProp instances can corrupt highlighting.
  const versions = new Set([...lock.matchAll(/^ {2}'@lezer\/common@([^']+)':/gm)].map(([, version]) => version))
  assert.deepEqual([...versions], ['1.5.3'])
  assert.match(lock, /^ {2}'@lezer\/common': 1\.5\.3$/m)
  assert.doesNotMatch(lock, /^ {6}'@lezer\/common': 1\.5\.2$/m)
})
