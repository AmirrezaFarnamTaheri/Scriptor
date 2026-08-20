import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = path.resolve(import.meta.dirname, '../..')

function functionBody(source, name) {
  const match = new RegExp(`\\b(?:pub\\s+)?(?:async\\s+)?fn\\s+${name}\\s*\\(`).exec(source)
  assert.ok(match, `${name} function must exist`)
  const opening = source.indexOf('{', match.index)
  assert.ok(opening >= 0, `${name} must have a body`)
  let depth = 0
  let inString = false
  let escaped = false
  for (let index = opening; index < source.length; index += 1) {
    const char = source[index]
    if (inString) {
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') inString = true
    else if (char === '{') depth += 1
    else if (char === '}') {
      depth -= 1
      if (depth === 0) return source.slice(opening, index + 1)
    }
  }
  assert.fail(`${name} body is unterminated`)
}

test('publish apply itself consumes a PublishSite authorization grant', () => {
  const source = fs.readFileSync(
    path.join(root, 'apps/desktop/src-tauri/src/commands/publish.rs'),
    'utf8',
  )
  const apply = functionBody(source, 'vault_publish_apply_starlight')
  assert.match(apply, /authorization_token/)
  assert.match(apply, /require_sensitive_operation/)
  assert.match(apply, /SensitiveOperation::PublishSite/)

  const plan = functionBody(source, 'vault_publish_plan_starlight')
  assert.doesNotMatch(plan, /require_sensitive_operation|SensitiveOperation::PublishSite/)
})
