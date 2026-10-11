import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseRuntimeConsoleResult, RUNTIME_CONSOLE_OUTPUT_LIMIT, validateRuntimeConsoleInput } from './runtime-console.ts'
test('runtime console accepts bounded supported code and rejects oversized or unsupported requests', () => {
  validateRuntimeConsoleInput('python', 'print(1)')
  assert.throws(() => validateRuntimeConsoleInput('shell', 'echo hello'))
  assert.throws(() => validateRuntimeConsoleInput('python', ' '))
  assert.throws(() => validateRuntimeConsoleInput('python', 'a'.repeat(64001)))
  assert.throws(() => validateRuntimeConsoleInput('python', '\0'))
})
test('runtime console validates native results and bounds displayed output', () => {
  const result = parseRuntimeConsoleResult({ exit_code: 1, stdout: 'a'.repeat(RUNTIME_CONSOLE_OUTPUT_LIMIT + 1), stderr: 'failed', duration_ms: 20, language: 'python' })
  assert.equal(result.exit_code, 1)
  assert.ok(result.stdout.endsWith('[Output truncated]'))
  assert.throws(() => parseRuntimeConsoleResult({ exit_code: NaN, stdout: '', stderr: '', duration_ms: 0, language: 'python' }))
  assert.throws(() => parseRuntimeConsoleResult({ exit_code: 0, stdout: {}, stderr: '', duration_ms: 0, language: 'python' }))
})
