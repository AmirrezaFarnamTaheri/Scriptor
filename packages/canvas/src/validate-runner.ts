import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import type { CanvasDocument } from '@scriptor/core/contracts/canvas'

import { runCanvasValidationTests } from './index.ts'

function loadFixture(name: string): CanvasDocument {
  const root = join(dirname(fileURLToPath(import.meta.url)), '../../test-fixtures/canvas')
  const raw = readFileSync(join(root, name), 'utf8')
  return JSON.parse(raw) as CanvasDocument
}

const failures = runCanvasValidationTests(loadFixture)
if (failures.length > 0) {
  console.error('Canvas validation failed:')
  for (const failure of failures) {
    console.error(`- ${failure}`)
  }
  process.exit(1)
}

console.log('Canvas validation passed')
