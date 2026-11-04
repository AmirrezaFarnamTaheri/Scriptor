import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const diagramPath = 'crates/export-runner/src/diagram.rs'
const diagramSource = fs.readFileSync(path.join(root, diagramPath), 'utf8')
const productionSource = diagramSource.split('#[cfg(test)]')[0]
const processInventory = JSON.parse(
  fs.readFileSync(path.join(root, 'scripts/validation/process-launch-inventory.json'), 'utf8'),
)

test('MAT-021: diagram renderers delegate external processes to the shared system broker', () => {
  assert.match(
    productionSource,
    /use scriptor_system_bridge::\{[^}]*\bProcessSpec\b[^}]*\brun_process\b[^}]*\}/s,
    'diagram execution must use the shared ProcessSpec/run_process boundary',
  )
  assert.doesNotMatch(
    productionSource,
    /(?:std::process::)?Command::new\s*\(/,
    'diagram production code must not spawn external processes directly',
  )
  assert.equal(
    processInventory.entries.filter((entry) => entry.file === diagramPath).length,
    0,
    'diagram renderers and discovery must not retain process-broker exceptions',
  )
})
