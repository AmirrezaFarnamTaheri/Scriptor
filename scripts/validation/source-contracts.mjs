import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = path.resolve(import.meta.dirname, '../..')
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8')

test('ipc exports use one canonical path and contain every TS type', () => {
  const rust = read('crates/ipc/src/lib.rs')
  const generated = read('packages/core/src/contracts/ipc-generated.ts')
  const exportedTypes = [...rust.matchAll(/#\[derive\([^\]]*\bTS\b[^\]]*\)\][\s\S]*?pub (?:struct|enum) (\w+)/g)]
    .map((match) => match[1])
  assert.ok(exportedTypes.length >= 9)
  assert.equal(new Set([...rust.matchAll(/export_to = "([^"]+)"/g)].map((match) => match[1])).size, 1)
  for (const typeName of exportedTypes) {
    assert.match(generated, new RegExp(`export type ${typeName}\\b`), `${typeName} missing from generated contract`)
  }
  assert.equal(fs.existsSync(path.join(root, 'crates/packages/core/src/contracts/ipc-generated.ts')), false)
})
test('knowledge tabs have unique localized labels in every shipped locale', () => {
  const source = read('src/components/KnowledgeWorkbench.tsx')
  const keys = [...source.matchAll(/labelKey: '([^']+)'/g)].map((match) => match[1])
  assert.equal(new Set(keys).size, keys.length)
  for (const locale of ['en', 'de', 'fa']) {
    const messages = JSON.parse(read(`src/lib/i18n/${locale}.json`))
    for (const key of keys) {
      const value = key.split('.').reduce((current, segment) => current?.[segment], messages)
      assert.equal(typeof value, 'string', `${locale} missing ${key}`)
      assert.ok(value.trim().length > 0, `${locale} has empty ${key}`)
    }
  }
})

test('shared modal shell implements modal focus and tab semantics', () => {
  const source = read('src/components/chrome/UnifiedPanelShell.tsx')
  for (const required of ['useFocusTrap', 'aria-modal', 'aria-labelledby', 'aria-describedby', "'tabpanel'", 'aria-controls', 'tabIndex={selected ? 0 : -1}']) {
    assert.ok(source.includes(required), `missing ${required}`)
  }
})

test('renderer never sends PlantUML source to a public service implicitly', () => {
  const source = read('packages/renderer/src/plantuml-client.ts')
  assert.doesNotMatch(source, /plantuml\.com|fetch\s*\(/)
})

test('vault config runtime parser preserves every supported optional section', () => {
  const source = read('src/types/vaultValidators.ts')
  for (const field of [
    'inbox',
    'workflow',
    'note_types',
    'export_on_save',
    'writing_targets',
    'graph_groups',
    'extra_roots',
    'canvas',
    'mcp',
  ]) {
    assert.ok(source.includes(field), `vault config parser missing ${field}`)
  }
  assert.doesNotMatch(source, /JSON\.parse\([^)]*\)\s+as\s+VaultConfig/)
})

test('editor engines are loaded only when their editor mode is rendered', () => {
  const main = read('src/main.tsx')
  const workspace = read('src/components/shell/EditorWorkspace.tsx')
  const lazyEditor = read('src/components/editor/LazyMonacoMarkdownEditor.tsx')
  const lazyCodeMirror = read('src/components/editor/LazyCodeMirrorMarkdownEditor.tsx')
  const editorIndex = read('packages/editor/src/index.ts')
  assert.doesNotMatch(main, /monaco-environment/)
  assert.match(workspace, /lazy\(\(\) =>\s*import\('\.\.\/editor\/LazyMonacoMarkdownEditor'\)/)
  assert.match(workspace, /lazy\(\(\) =>\s*import\('\.\.\/editor\/LazyCodeMirrorMarkdownEditor'\)/)
  assert.match(workspace, /<Suspense[\s\S]*?<LazyMonacoMarkdownEditor/)
  assert.match(workspace, /<Suspense[\s\S]*?<LazyCodeMirrorMarkdownEditor/)
  assert.match(lazyEditor, /import '\.\.\/\.\.\/lib\/monaco-environment'/)
  assert.match(lazyCodeMirror, /@scriptor\/editor\/codemirror/)
  assert.doesNotMatch(workspace, /\bMarkdownEditor\s*,/)
  assert.doesNotMatch(editorIndex, /export\s*\{\s*MarkdownEditor\s*\}\s*from\s*['"]\.\/codemirror['"]/)
})

test('disabled updater is absent from source manifests and lockfiles', () => {
  const packageJson = fs.readFileSync(path.join(root, 'package.json'), 'utf8')
  const pnpmLock = fs.readFileSync(path.join(root, 'pnpm-lock.yaml'), 'utf8')
  const desktopCargo = fs.readFileSync(path.join(root, 'apps/desktop/src-tauri/Cargo.toml'), 'utf8')
  const cargoLock = fs.readFileSync(path.join(root, 'Cargo.lock'), 'utf8')
  const generatedSchemas = fs
    .readdirSync(path.join(root, 'apps/desktop/src-tauri/gen/schemas'))
    .filter((name) => name.endsWith('.json'))
    .map((name) => fs.readFileSync(path.join(root, 'apps/desktop/src-tauri/gen/schemas', name), 'utf8'))
    .join('\n')
  const packageScript = read('scripts/release/package.ps1')
  assert.equal(packageJson.includes('@tauri-apps/plugin-updater'), false)
  assert.equal(pnpmLock.includes('@tauri-apps/plugin-updater'), false)
  assert.equal(desktopCargo.includes('tauri-plugin-updater'), false)
  assert.equal(cargoLock.includes('name = "tauri-plugin-updater"'), false)
  assert.equal(generatedSchemas.includes('updater:'), false)
  assert.equal(fs.existsSync(path.join(root, 'scripts/release/inject-updater-config.mjs')), false)
  assert.equal(packageScript.includes('updater'), false)
})

test('daemon IPC requires the authenticated endpoint nonce on every production connection', () => {
  const transport = read('crates/daemon/src/transport.rs')
  const client = read('crates/daemon/src/client.rs')
  const windowsClient = read('crates/daemon/src/windows_rpc.rs')
  const ipc = read('crates/ipc/src/lib.rs')
  const desktop = read('apps/desktop/src-tauri/src/lib.rs')
  assert.match(transport, /endpoint_nonce:\s*endpoint\.nonce/)
  assert.match(transport, /invalid or missing endpoint nonce/)
  assert.match(client, /authenticated_request\.endpoint_nonce\s*=\s*connection\.endpoint_nonce\.clone\(\)/)
  assert.match(client, /subscribe\.endpoint_nonce\s*=\s*endpoint\.nonce/)
  assert.match(client, /connect_event_stream\(\)/)
  assert.match(client, /RpcEventPayload::ResyncRequired/)
  assert.match(ipc, /ResyncRequired\s*\{\s*reason:\s*String\s*\}/)
  assert.match(desktop, /daemon:resync-required/)
  assert.match(windowsClient, /request\.endpoint_nonce\s*=\s*endpoint\.nonce/)
})

test('MCP mutation journaling validates paths before durable intent and never hides outcome-write failure', () => {
  const source = read('crates/daemon/src/mcp_stdio.rs')
  const writeStart = source.indexOf('fn write_note_with_audit')
  const updateStart = source.indexOf('fn update_frontmatter_with_audit')
  const writeBody = source.slice(writeStart, updateStart)
  const updateBody = source.slice(updateStart)
  for (const body of [writeBody, updateBody]) {
    assert.ok(body.indexOf('RelativeVaultPath::parse(path)') < body.indexOf('McpMutationAuditRecord::intent'))
    assert.match(body, /audit outcome could not be persisted/)
    assert.match(body, /do not retry automatically/)
  }
})

test('local toolchains are pinned alongside CI', () => {
  const toolchain = read('rust-toolchain.toml')
  const packageJson = JSON.parse(read('package.json'))
  assert.match(toolchain, /channel\s*=\s*"1\.96\.0"/)
  assert.match(toolchain, /components\s*=\s*\["clippy",\s*"rustfmt"\]/)
  assert.equal(packageJson.packageManager, 'pnpm@10.33.0')
})

test('macOS process sandbox escapes user-controlled writable paths', () => {
  const source = read('crates/system-bridge/src/process.rs')
  assert.match(source, /escape_sandbox_profile_string\(current_dir\.as_os_str\(\)\)/)
  assert.match(source, /\.replace\('"', "\\\\\\""\)/)
})

test('performance baselines use the release executable and a hashed 1k fixture', () => {
  const source = read('scripts/benchmarks/check-baselines.mjs')
  const utilities = read('scripts/benchmarks/benchmark-utils.mjs')
  assert.match(source, /'build', '--locked', '--release', '-p', 'scriptor-cli'/)
  assert.match(source, /const vaultSize = 1000/)
  assert.match(source, /synthetic vault cardinality mismatch/)
  assert.match(source, /hashDirectory\(syntheticVault\)/)
  assert.match(source, /expectedNotes: vaultSize/)
  assert.doesNotMatch(source, /vaults\/minimal|'run', '-p', 'scriptor-cli'/)
  assert.match(utilities, /parseBenchmarkReport/)
  assert.match(utilities, /tree\.update\(relative\)/)
})

test('release evidence binds exact source and rejects unreceipted artifacts', () => {
  const receipt = read('scripts/release/create-receipt.mjs')
  const verifier = read('scripts/release/verify-release-evidence.mjs')
  const utilities = read('scripts/release/release-evidence-utils.mjs')
  const sbom = read('scripts/release/generate-sbom.mjs')
  assert.match(receipt, /getSourceIdentity/)
  assert.match(receipt, /collectSubjectFiles/)
  assert.match(verifier, /requireGit:\s*true/)
  assert.match(verifier, /requireClean:\s*true/)
  assert.match(verifier, /assertExactSubjectSet/)
  assert.match(verifier, /parseSha256Sums/)
  assert.match(utilities, /unreceipted:/)
  assert.match(utilities, /release subjects may not contain symbolic links/)
  assert.match(sbom, /parsePnpmLockPackages/)
  assert.match(sbom, /parseCargoLockPackages/)
  assert.doesNotMatch(sbom, /scriptor:declared-range/)
})


test('frontend polish regression contracts pass under the pinned Node runtime', () => {
  const result = spawnSync(
    process.execPath,
    [
      '--experimental-strip-types',
      '--test',
      path.join(root, 'scripts/validation/frontend-polish-contracts.test.mjs'),
    ],
    { cwd: root, encoding: 'utf8' },
  )
  assert.equal(
    result.status,
    0,
    [result.stdout, result.stderr].filter(Boolean).join('\n'),
  )
})
