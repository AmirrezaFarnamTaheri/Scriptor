import assert from 'node:assert/strict'
import test from 'node:test'
import { parseKernelSession, parseKernelResult, parseRuntimeEnvironment, runtimeRunScope, runtimeStartScope } from './runtime-kernel.ts'
const id = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
test('runtime environment is bounded and excludes process configuration overrides', () => {
  assert.deepEqual(parseRuntimeEnvironment('PROJECT=research\nCOUNT=2'), { PROJECT: 'research', COUNT: '2' })
  for (const input of ['PATH=/tmp', 'PYTHONPATH=/tmp', 'LD_PRELOAD=x', 'bad name=x', 'A=1\nA=2']) assert.throws(() => parseRuntimeEnvironment(input))
})
test('runtime consent binds the exact reviewed environment, session and source', async () => {
  assert.equal(await runtimeStartScope({ B: '2', A: '1' }), await runtimeStartScope({ A: '1', B: '2' }))
  assert.notEqual(await runtimeStartScope({ A: '1' }), await runtimeStartScope({ A: '2' }))
  assert.notEqual(await runtimeRunScope(id, 'x=1'), await runtimeRunScope(id, 'x=2'))
})
test('kernel responses require owner identity and bounded PNG plots', () => {
  const session = { id, vault_id: 'v', language: 'python', python_version: '3.13', executable: 'python', remaining_seconds: 900 }
  assert.equal(parseKernelSession(session, 'v').id, id)
  assert.throws(() => parseKernelSession(session, 'other'))
  const result = { session_id: id, exit_code: 0, duration_ms: 1, language: 'python', stdout: '1', stderr: '', variables: [{ name: 'x', type: 'int', value: '1' }], plots: [] }
  assert.equal(parseKernelResult(result, id).variables[0].value, '1')
  assert.throws(() => parseKernelResult({ ...result, session_id: 'other' }, id))
  assert.throws(() => parseKernelResult({ ...result, plots: [{ mime_type: 'image/svg+xml', data_base64: 'PHN2Zz4=', caption: 'x' }] }, id))
  assert.equal(parseKernelResult({ ...result, variables: [{ name: '𝑥'.repeat(128), type: 'int', value: '𝑥'.repeat(512) }] }, id).variables.length, 1)
  assert.throws(() => parseKernelResult({ ...result, variables: [{ name: '𝑥'.repeat(129), type: 'int', value: '1' }] }, id))
})
