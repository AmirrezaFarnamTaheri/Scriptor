import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const processSource = fs.readFileSync(path.join(root, 'crates/system-bridge/src/process.rs'), 'utf8')

test('MAT-021: Unix process liveness rejects out-of-range u32 before casting to signed POSIX pid', () => {
  const func = processSource.match(/pub fn process_alive\(pid: u32\) -> bool \{([\s\S]*?)\n\}\n\n#\[derive/)
  assert.ok(func, 'process_alive must remain a bounded broker API')
  const unixBlock = func[1].match(/#\[cfg\(unix\)\]\s*\{([\s\S]*?)\n    \}\n/)
  assert.ok(unixBlock, 'POSIX branch must remain present')
  assert.match(unixBlock[1], /pid\s*>\s*i32::MAX\s+as\s+u32/, 'reject high-bit unsigned PIDs before i32 cast')
  assert.match(unixBlock[1], /return false/, 'invalid unsigned PID must not be treated as live')
})
