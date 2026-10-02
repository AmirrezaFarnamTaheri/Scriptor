import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validateGraphvizSource, validateGraphvizOutput } from './graphviz-policy.ts'

test('Graphviz bounds real UTF-8 inputs and SVG output', () => {
  assert.equal(validateGraphvizSource('digraph { A -> B }'), 'digraph { A -> B }')
  assert.throws(() => validateGraphvizSource(' '), /source/)
  assert.throws(() => validateGraphvizSource('é'.repeat(33_000)), /64 KiB/)
  assert.throws(() => validateGraphvizSource('digraph\0{}'), /NUL/)
  assert.equal(validateGraphvizOutput('<svg xmlns="http://www.w3.org/2000/svg"/>').startsWith('<svg'), true)
  assert.throws(() => validateGraphvizOutput('x'.repeat(4_194_305)), /4 MiB/)
  assert.throws(() => validateGraphvizOutput('not an SVG'), /SVG/)
})
