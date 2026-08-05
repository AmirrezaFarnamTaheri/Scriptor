import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const root = process.env.SCRIPTOR_SOURCE_ROOT ?? process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')

test('resource sync is backend-owned and approval-gated', () => {
  const rust = read('apps/desktop/src-tauri/src/commands/resources/mod.rs')
  const auth = read('src/bridge/commands/authorization.ts')
  const bridge = read('src/bridge/commands/resources.ts')

  assert.match(rust, /resource_apply_plan/)
  assert.match(rust, /SensitiveOperation::ResourceSync/)
  assert.match(rust, /inventory changed after plan approval/)
  assert.match(rust, /MAX_PARALLEL_OPERATIONS/)
  assert.match(rust, /PLAN_TTL_MS/)
  assert.match(rust, /APPLY_LOCK/)
  assert.match(auth, /'resource_sync'/)
  assert.match(bridge, /authorizeSensitiveOperation\('resource_sync', planId\)/)
  assert.match(rust, /resource_create_dedup_plan/)
  assert.match(rust, /QuarantineDuplicate/)
})

test('target discovery distinguishes evidence and includes broad adapters', () => {
  const catalog = read('apps/desktop/src-tauri/src/commands/resources/catalog.rs')
  const discovery = read('apps/desktop/src-tauri/src/commands/resources/discovery.rs')
  const targetIds = [...catalog.matchAll(/target\(\s*"([^"]+)"/g)].map((match) => match[1])

  assert.ok(targetIds.length >= 20, `expected at least 20 targets, found ${targetIds.length}`)
  for (const id of ['agentstack', 'claude-code', 'codex', 'vscode', 'cursor', 'windsurf', 'jetbrains', 'gemini-cli', 'cline', 'roo-code', 'continue', 'aider', 'goose', 'opencode', 'kiro', 'trae', 'antigravity']) {
    assert.ok(targetIds.includes(id), `missing target ${id}`)
  }
  assert.match(discovery, /TargetStatus::Configured/)
  assert.match(discovery, /TargetStatus::Confirmed/)
  assert.match(discovery, /receipt\.exit_code == 0/)
  assert.match(discovery, /ResourceEvidence::Application/)
  assert.match(discovery, /ResourceEvidence::Extension/)
  assert.match(discovery, /MAX_PARALLEL_TARGET_PROBES/)
  assert.match(discovery, /issues\.is_empty\(\)/)
  assert.match(discovery, /DuplicateKind::ExactMirror/)
  assert.match(discovery, /DuplicateKind::Redundant/)
  assert.match(discovery, /automatic_removal_allowed: false/)
})

test('normal UI exposes structured sharing state without raw process streams', () => {
  const panel = read('src/components/ResourceSyncPanel.tsx')
  const mcp = read('src/components/McpPanel.tsx')

  assert.match(panel, /Sharing and sync/)
  assert.match(panel, /Already installed or contained/)
  assert.match(panel, /Reviewed synchronization plan/)
  assert.doesNotMatch(panel, /stdout|stderr|npm install|pnpm install/)
  assert.match(mcp, /Sharing & sync/)
  assert.match(mcp, /ResourceSyncPanel/)
})

test('desktop is the authoritative app entry point and branding is bundled', () => {
  const packageJson = JSON.parse(read('package.json'))
  const tauriConfig = JSON.parse(read('apps/desktop/src-tauri/tauri.conf.json'))
  const vite = read('vite.config.ts')
  const branding = read('scripts/validation/desktop-branding.mjs')

  assert.equal(packageJson.scripts.dev, 'pnpm desktop:dev')
  assert.equal(packageJson.scripts['web:dev'], 'vite --host 127.0.0.1')
  assert.equal(packageJson.scripts['desktop:build'], 'pnpm --dir apps/desktop build')
  assert.equal(packageJson.scripts['prepare:desktop'], 'node scripts/release/stage-daemon-sidecar.mjs')
  assert.equal(tauriConfig.build.beforeDevCommand, 'pnpm --dir ../.. web:dev')
  assert.equal(tauriConfig.build.beforeBuildCommand, 'pnpm --dir ../.. web:build')
  assert.match(vite, /open:\s*false/)
  assert.ok(tauriConfig.bundle.icon.includes('icons/icon.ico'))
  assert.ok(tauriConfig.bundle.icon.includes('icons/icon.icns'))
  assert.equal(tauriConfig.bundle.windows.nsis.installerIcon, 'icons/icon.ico')
  assert.match(branding, /PNG signature is invalid/)
  assert.match(branding, /ICO signature is invalid/)
  assert.match(branding, /ICNS signature is invalid/)
})
