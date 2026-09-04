#!/usr/bin/env node
import { once } from 'node:events'
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const vault = process.argv[2] ?? 'packages/test-fixtures/vaults/minimal'
const TAIL_LINES = 60

process.chdir(root)
console.log(`Running Scriptor TUI smoke against ${vault}`)

const child = spawn(
  'cargo',
  ['run', '-p', 'scriptor-cli', '--', 'tui', vault, '--smoke-test', '--in-process'],
  { stdio: ['ignore', 'pipe', 'pipe'] },
)

// Stream the child output live *and* keep a rolling tail of it. The tail is
// re-emitted when the smoke fails because CI annotations only carry the last
// lines of a step: with an inherited stdio the failure arrived as a bare exit
// code, which made a compile error, a panic, and an assertion indistinguishable.
const tail = []
function record(stream, sink) {
  let pending = ''
  stream.setEncoding('utf8')
  stream.on('data', (chunk) => {
    sink.write(chunk)
    const lines = (pending + chunk).split('\n')
    pending = lines.pop() ?? ''
    for (const line of lines) {
      tail.push(line)
      if (tail.length > TAIL_LINES) tail.shift()
    }
  })
  stream.on('end', () => {
    if (pending) tail.push(pending)
    pending = ''
  })
}
record(child.stdout, process.stdout)
record(child.stderr, process.stderr)

// `close` rather than `exit`: the pipes are fully drained by then, so the
// reported tail really is the end of the run.
const [code, signal] = await once(child, 'close')
if (code !== 0) {
  const reason = signal ? `signal ${signal}` : `exit ${code ?? 'null'}`
  console.error(`TUI smoke failed (${reason}). Last ${TAIL_LINES} lines of the run:`)
  console.error(tail.join('\n'))
  process.exit(code ?? 1)
}
