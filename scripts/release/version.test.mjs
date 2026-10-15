import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

const project = path.resolve(import.meta.dirname, '../..')
const sources = {
  'scripts/release/version.mjs': fs.readFileSync(path.join(project, 'scripts/release/version.mjs'), 'utf8'),
  'scripts/lib/workspace-files.mjs': fs.readFileSync(path.join(project, 'scripts/lib/workspace-files.mjs'), 'utf8'),
}

function fixture({ desktop = '1.3.1', mobile = '1.3.0' } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'scriptor-version-'))
  const files = {
    ...sources,
    VERSION: '1.3.1\n',
    'package.json': JSON.stringify({ name: 'test-release-fixture', version: '1.3.1', type: 'module' }) + '\n',
    'apps/desktop/src-tauri/tauri.conf.json': JSON.stringify({ version: desktop }) + '\n',
    'apps/mobile/src-tauri/tauri.conf.json': JSON.stringify({ version: mobile }) + '\n',
    'packages/mcp/src/server.ts': "export const MCP_SERVER_VERSION = '1.3.1'\n",
  }
  for (const [relative, content] of Object.entries(files)) {
    const full = path.join(root, relative)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, content)
  }
  return { root, cleanup: () => fs.rmSync(root, { recursive: true, force: true }) }
}

function run(root, mode, env = {}) {
  return spawnSync(process.execPath, [path.join(root, 'scripts/release/version.mjs'), mode], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, GITHUB_REF_NAME: '', SCRIPTOR_RELEASE_VERSION: '', ...env },
  })
}

test('version check rejects mobile Tauri drift instead of silently passing', (t) => {
  const checkout = fixture()
  t.after(checkout.cleanup)
  const outcome = run(checkout.root, 'check')
  assert.equal(outcome.status, 1, outcome.stdout + outcome.stderr)
  assert.match(outcome.stderr, /apps[/\\]mobile[/\\]src-tauri[/\\]tauri\.conf\.json: 1\.3\.0/)
})

test('version sync updates both desktop and mobile Tauri config', (t) => {
  const checkout = fixture({ desktop: '1.3.0', mobile: '1.3.0' })
  t.after(checkout.cleanup)
  const sync = run(checkout.root, 'sync')
  assert.equal(sync.status, 0, sync.stdout + sync.stderr)
  for (const app of ['desktop', 'mobile']) {
    const config = JSON.parse(fs.readFileSync(path.join(checkout.root, 'apps/' + app + '/src-tauri/tauri.conf.json'), 'utf8'))
    assert.equal(config.version, '1.3.1', app)
  }
  const verified = run(checkout.root, 'check')
  assert.equal(verified.status, 0, verified.stdout + verified.stderr)
})

test('release inputs cannot override the canonical version', (t) => {
  const checkout = fixture({ mobile: '1.3.1' })
  t.after(checkout.cleanup)
  const outcome = run(checkout.root, 'check', { SCRIPTOR_RELEASE_VERSION: 'v1.3.2' })
  assert.equal(outcome.status, 1, outcome.stdout + outcome.stderr)
  assert.match(outcome.stderr, /release input\/tag: 1\.3\.2/)
})
