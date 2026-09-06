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
    'semantic',
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

test('built-in self updater stays disabled until signed updates are supported', () => {
  const desktopCargo = fs.readFileSync(path.join(root, 'apps/desktop/src-tauri/Cargo.toml'), 'utf8')
  const libRs = read('apps/desktop/src-tauri/src/lib.rs')
  const tauriConfig = read('apps/desktop/src-tauri/tauri.conf.json')
  const capability = read('apps/desktop/src-tauri/capabilities/default.json')
  assert.equal(desktopCargo.includes('tauri-plugin-updater'), false)
  assert.equal(libRs.includes('tauri_plugin_updater'), false)
  assert.equal(libRs.includes('updater_check'), false)
  assert.equal(libRs.includes('updater_install'), false)
  assert.equal(tauriConfig.includes('"updater"'), false)
  assert.equal(capability.includes('updater:'), false)
})

test('incubating embeddings stay outside the default desktop product boundary', () => {
  const workspace = read('Cargo.toml')
  const desktopCargo = read('apps/desktop/src-tauri/Cargo.toml')
  const desktopLib = read('apps/desktop/src-tauri/src/lib.rs')
  const searchStore = read('src/hooks/useSearchStore.ts')
  const bridgeIndex = read('src/bridge/commands/index.ts')
  assert.match(workspace, /incubating\s*=\s*\[[^\]]*"embeddings"/s)
  assert.doesNotMatch(desktopCargo, /scriptor-embeddings/)
  assert.doesNotMatch(desktopLib, /commands::embeddings|embeddings_(?:index_note|remove_note|search)/)
  assert.doesNotMatch(searchStore, /EmbeddingProviderConfig|embeddingsSearch|embeddingConfig|semanticWeight/)
  assert.doesNotMatch(bridgeIndex, /embeddings/)
})

test('daemon IPC requires the authenticated endpoint nonce on every production connection', () => {
  const transport = read('crates/daemon/src/transport.rs')
  const client = read('crates/daemon/src/client.rs')
  const windowsClient = read('crates/daemon/src/windows_rpc.rs')
  const ipc = read('crates/ipc/src/lib.rs')
  const desktop = read('apps/desktop/src-tauri/src/lib.rs')
  // The authority is the transport's own expected nonce, not a copy in `DaemonState`:
  // a daemon that cannot establish one refuses to serve, and the comparison is
  // constant-time against that value.
  assert.match(transport, /generated endpoint is missing nonce/)
  assert.match(transport, /constant_time_eq\(\s*provided\.as_bytes\(\),\s*expected_nonce\.as_bytes\(\)\s*\)/)
  assert.match(transport, /invalid or missing endpoint nonce/)
  assert.match(client, /authenticated_request\.endpoint_nonce\s*=\s*connection\.endpoint_nonce\.clone\(\)/)
  assert.match(client, /subscribe\.endpoint_nonce\s*=\s*endpoint\.nonce/)
  assert.match(client, /connect_event_stream\(\)/)
  assert.match(client, /RpcEventPayload::ResyncRequired/)
  assert.match(ipc, /ResyncRequired\s*\{\s*reason:\s*String\s*,?\s*\}/)
  assert.match(desktop, /daemon:resync-required/)
  assert.match(windowsClient, /request\.endpoint_nonce\s*=\s*endpoint\.nonce/)
})

test('MCP mutation journaling validates paths before durable intent and never hides outcome-write failure', () => {
  const source = read('crates/daemon/src/automation_stdio.rs')
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
  assert.match(source, /\.replace\('"', "\\\\\\["]"\)/)
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
  assert.match(receipt, /collectSigningEvidence/)
  assert.match(receipt, /schemaVersion:\s*4/)
  assert.match(verifier, /requireGit:\s*true/)
  assert.match(verifier, /requireClean:\s*true/)
  assert.match(verifier, /assertExactSubjectSet/)
  assert.match(verifier, /parseSha256Sums/)
  assert.match(verifier, /assertSigningEvidence/)
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


test('release hardening and RustSec ownership contracts pass under the pinned Node runtime', () => {
  for (const script of [
    'scripts/validation/release-hardening-contracts.test.mjs',
    'scripts/validation/rustsec-exceptions.test.mjs',
    'scripts/release/signing-policy.test.mjs',
  ]) {
    const result = spawnSync(process.execPath, ['--test', path.join(root, script)], {
      cwd: root,
      encoding: 'utf8',
    })
    assert.equal(result.status, 0, [result.stdout, result.stderr].filter(Boolean).join('\n'))
  }
  const ledger = spawnSync(process.execPath, ['scripts/validation/rustsec-exceptions.mjs'], {
    cwd: root,
    encoding: 'utf8',
  })
  assert.equal(ledger.status, 0, [ledger.stdout, ledger.stderr].filter(Boolean).join('\n'))
})

test('local publishing is composed through one hardened desktop and CLI engine', () => {
  const workspace = read('Cargo.toml')
  const desktopCargo = read('apps/desktop/src-tauri/Cargo.toml')
  const cliCargo = read('crates/cli/Cargo.toml')
  const desktopLib = read('apps/desktop/src-tauri/src/lib.rs')
  const publishCommand = read('apps/desktop/src-tauri/src/commands/publish.rs')
  const legacy = read('apps/desktop/src-tauri/src/commands/code_chunk.rs')
  const cli = read('crates/cli/src/commands/vault.rs')
  const compile = read('crates/publish-runner/src/compile.rs')
  const localSite = read('crates/publish-runner/src/local_site.rs')

  assert.match(workspace, /"crates\/publish-runner"/)
  assert.match(desktopCargo, /scriptor-publish-runner\s*=\s*\{\s*path/)
  assert.match(cliCargo, /scriptor-publish-runner\s*=\s*\{\s*path/)
  assert.match(desktopLib, /vault_publish_plan_starlight/)
  assert.match(desktopLib, /vault_publish_apply_starlight/)
  assert.match(publishCommand, /require_sensitive_operation[\s\S]*SensitiveOperation::PublishSite/)
  assert.doesNotMatch(legacy, /vault_publish_starlight/)
  assert.match(cli, /scriptor_publish_runner::plan_starlight_site/)
  assert.match(cli, /scriptor_publish_runner::apply_starlight_site/)
  assert.match(compile, /let fresh_plan = plan_publish/)
  assert.match(compile, /current_hash != reviewed\.content_hash/)
  assert.match(compile, /fresh_orphans/)
  assert.match(compile, /managed publish paths may not traverse symbolic links/)
  assert.match(compile, /source_unchanged/)
  assert.match(compile, /sink\.content_hash\(rel\)/)
  assert.match(localSite, /fn output_drift\(/)
  assert.match(localSite, /drifted\.contains\(&candidate\.rel_path\)/)
  assert.match(localSite, /managed_output_drift_can_be_repaired_by_reviewed_apply/)
  assert.match(localSite, /UnsafeOutputRoot/)
})

test('desktop Git mutations serialize through the bounded per-repo queue', () => {
  const state = read('apps/desktop/src-tauri/src/state.rs')
  const gitCommands = read('apps/desktop/src-tauri/src/commands/git.rs')
  const queue = read('crates/native-git/src/queue.rs')

  assert.match(state, /git_queue:\s*Mutex<Option<Arc<GitQueue>>>/)
  assert.match(state, /pub fn git_queue_handle/)
  const queueUses = [...gitCommands.matchAll(/git_queue_handle\(&state/g)]
  assert.ok(
    queueUses.length >= 5,
    `expected all desktop Git mutations to enqueue through the queue, found ${queueUses.length}`,
  )
  assert.doesNotMatch(gitCommands, /lock_recover\(&state\.git_mutation_lock/)
  const daemonGateway = read('crates/daemon/src/command_gateway.rs')
  const daemonEnqueues = [...daemonGateway.matchAll(/\.git_queue\(\)/g)]
  assert.ok(
    daemonEnqueues.length >= 4,
    `expected daemon git mutations to enqueue through the queue, found ${daemonEnqueues.length}`,
  )
  assert.match(queue, /MAX_PENDING_GIT_OPERATIONS:\s*usize\s*=\s*64/)
  assert.match(queue, /mpsc::sync_channel::<Task>\(MAX_PENDING_GIT_OPERATIONS\)/)
  assert.doesNotMatch(queue, /mpsc::channel::<Task>/)
})

test('citation UI uses the composed indexer backend and makes no Zotero sync claim', () => {
  const manifest = read('src/components/inspector/citation-plugin-manifest.ts')
  const dispatch = read('src/lib/pluginCommandDispatch.ts')
  const maturity = read('docs/CAPABILITY-MATURITY.md')

  assert.match(manifest, /rustFeatureGate:\s*'scriptor-indexer'/)
  assert.match(manifest, /commandId:\s*'citations\.insert'/)
  assert.doesNotMatch(manifest, /citations\.sync|Zotero/)
  assert.match(dispatch, /case 'citations\.insert':[\s\S]*openBibliography/)
  assert.match(maturity, /Zotero Web API connector \| Experimental \/ library-only/)
})
