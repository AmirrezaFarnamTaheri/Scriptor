import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const registryPath = path.join(root, 'apps/desktop/src-tauri/src/lib.rs')
const authorizationPath = path.join(root, 'apps/desktop/src-tauri/src/authorization.rs')
const bridgeAuthorizationPath = path.join(root, 'src/bridge/commands/authorization.ts')

const sensitiveCommands = [
  ['ai_provider_delete_api_key', 'apps/desktop/src-tauri/src/commands/system.rs', 'KeychainDelete', 'keychain_delete'],
  ['ai_provider_propose_draft', 'apps/desktop/src-tauri/src/commands/system.rs', 'AiNetworkRequest', 'ai_network_request'],
  ['ai_provider_set_api_key', 'apps/desktop/src-tauri/src/commands/system.rs', 'KeychainWrite', 'keychain_write'],
  ['code_chunk_run', 'apps/desktop/src-tauri/src/commands/code_chunk.rs', 'CodeExecution', 'code_execution'],
  ['daemon_start', 'apps/desktop/src-tauri/src/commands/daemon.rs', 'DaemonControl', 'daemon_control'],
  ['git_apply_merged_conflict_cmd', 'apps/desktop/src-tauri/src/commands/git.rs', 'ApplyGitConflict', 'apply_git_conflict'],
  ['git_pull_cmd', 'apps/desktop/src-tauri/src/commands/git.rs', 'GitPull', 'git_pull'],
  ['git_push_cmd', 'apps/desktop/src-tauri/src/commands/git.rs', 'GitPush', 'git_push'],
  ['git_resolve_conflict_cmd', 'apps/desktop/src-tauri/src/commands/git.rs', 'ApplyGitConflict', 'apply_git_conflict'],
  ['google_calendar_complete_task', 'apps/desktop/src-tauri/src/commands/google_calendar.rs', 'GoogleTaskWrite', 'google_task_write'],
  ['google_calendar_create_task', 'apps/desktop/src-tauri/src/commands/google_calendar.rs', 'GoogleTaskWrite', 'google_task_write'],
  ['google_calendar_delete_task', 'apps/desktop/src-tauri/src/commands/google_calendar.rs', 'GoogleTaskWrite', 'google_task_write'],
  ['google_calendar_disconnect', 'apps/desktop/src-tauri/src/commands/google_calendar.rs', 'GoogleCalendarDisconnect', 'google_calendar_disconnect'],
  ['google_calendar_start_auth', 'apps/desktop/src-tauri/src/commands/google_calendar.rs', 'GoogleCalendarAuth', 'google_calendar_auth'],
  ['latex_compile', 'apps/desktop/src-tauri/src/commands/latex.rs', 'LatexCompilation', 'latex_compilation'],
  ['pdf_translate', 'apps/desktop/src-tauri/src/commands/export.rs', 'PdfTranslation', 'pdf_translation'],
  ['plantuml_render', 'apps/desktop/src-tauri/src/commands/system.rs', 'PlantUmlExecution', 'plant_uml_execution'],
  ['resource_apply_plan', 'apps/desktop/src-tauri/src/commands/resources/mod.rs', 'ResourceSync', 'resource_sync'],
  ['vault_create_backup', 'apps/desktop/src-tauri/src/commands/backup.rs', 'CreateBackup', 'create_backup'],
  ['vault_delete_backup', 'apps/desktop/src-tauri/src/commands/backup.rs', 'DeleteBackup', 'delete_backup'],
  ['vault_delete_note', 'apps/desktop/src-tauri/src/commands/vault.rs', 'DeleteNote', 'delete_note'],
  ['vault_import_obsidian', 'apps/desktop/src-tauri/src/commands/vault.rs', 'ImportVault', 'import_vault'],
  ['vault_lint_fix', 'apps/desktop/src-tauri/src/commands/vault.rs', 'ApplyBulkFix', 'apply_bulk_fix'],
  ['vault_publish_apply_starlight', 'apps/desktop/src-tauri/src/commands/publish.rs', 'PublishSite', 'publish_site'],
  ['vault_restore_backup', 'apps/desktop/src-tauri/src/commands/backup.rs', 'RestoreBackup', 'restore_backup'],
  ['vault_restore_note_history_revision', 'apps/desktop/src-tauri/src/commands/history.rs', 'RestoreHistory', 'restore_history'],
]

// Read-only means the native handler does not mutate authoritative user/application
// state. In particular, planning publication is read-only; only apply is brokered.
const readOnlyCommands = [
  'health_check',
  'vault_scan',
  'vault_read_note',
  'vault_list_recent_notes',
  'vault_rename_dry_run',
  'vault_rename_tag_dry_run',
  'vault_rename_section_dry_run',
  'vault_rename_block_dry_run',
  'vault_load_config',
  'vault_load_snippets',
  'vault_load_template',
  'vault_build_note_markdown',
  'vault_plan_daily_note',
  'indexer_search',
  'indexer_list_tags',
  'indexer_notes_for_tag',
  'indexer_resolve_wikilink',
  'indexer_list_recent_files',
  'indexer_list_orphans',
  'indexer_list_inbox',
  'indexer_list_note_summaries',
  'indexer_list_dead_ends',
  'indexer_list_unresolved_targets',
  'indexer_batch_note_meta',
  'indexer_evaluate_view',
  'vault_list_view_notes',
  'indexer_list_bibliography',
  'indexer_backlinks',
  'indexer_graph',
  'export_discover',
  'git_status_cmd',
  'git_read_conflict_markers_cmd',
  'git_show_merge_base_file_cmd',
  'git_show_head_file_cmd',
  'indexer_traverse_graph',
  'indexer_execute_dql',
  'vault_read_stats_history',
  'vault_read_activity_log',
  'vault_read_workspace_session',
  'vault_list_note_history',
  'vault_read_note_history_revision',
  'indexer_health_diagnostics',
  'vault_health',
  'vault_list_backups',
  'vault_detect_obsidian',
  'ai_provider_has_api_key',
  'canvas_hit_test',
  'canvas_render_svg',
  'canvas_template_dry_run',
  'canvas_query_blocks',
  'canvas_list_templates',
  'canvas_snapshot',
  'canvas_load_document',
  'canvas_list_documents',
  'vault_publish_plan_starlight',
  'latex_discover_tectonic',
  'daemon_ping',
  'daemon_endpoint',
  'daemon_health_diagnostics',
  'daemon_health_report',
  'daemon_search',
  'daemon_list_note_summaries',
  'daemon_backlinks',
  'daemon_graph',
  'daemon_git_status',
  'daemon_export_job_status',
  'resource_inventory',
  'resource_create_plan',
  'resource_create_dedup_plan',
  'system_info',
  'google_calendar_list_events',
  'google_calendar_list_tasks',
  'google_calendar_get_authed_email',
  'indexer_query_tasks',
  'indexer_kanban_board',
  'reader_read_document',
  'reader_load_annotations',
  'plugin_state_get',
]

// These handlers intentionally mutate local state but are not in the one-time
// high-impact authorization broker. Keeping them explicit prevents a new command
// from silently falling through the authorization inventory.
const localMutationCommands = [
  'authorize_sensitive_operation',
  'set_headless_engine',
  'copy_text_to_clipboard',
  'vault_save_asset',
  'vault_open',
  'vault_save_note',
  'vault_record_recent_note',
  'vault_rename_apply',
  'vault_rename_tag_apply',
  'vault_rename_section_apply',
  'vault_rename_block_apply',
  'vault_save_snippets',
  'vault_save_config_cmd',
  'indexer_rebuild',
  'indexer_update_note',
  'indexer_apply_filesystem_changes',
  'indexer_record_recent_access',
  'export_run_note',
  'export_run_markdown',
  'export_start_note',
  'export_cancel',
  'git_commit_cmd',
  'vault_frontmatter_set',
  'vault_textbundle_export',
  'vault_append_stats_history',
  'vault_append_activity_log',
  'vault_save_workspace_session',
  'diagnostics_append_event',
  'canvas_apply_template',
  'canvas_restore_template',
  'canvas_save_document',
  'latex_cancel_compile',
  'daemon_open_vault',
  'daemon_rebuild_index',
  'daemon_save_note',
  'daemon_update_note_index',
  'daemon_rename_apply',
  'daemon_export_run_note',
  'daemon_export_run_markdown',
  'daemon_export_start_note',
  'daemon_export_cancel',
  'daemon_reload_config',
  'vault_export_audit_log',
  'indexer_update_task',
  'indexer_sync_note_tasks',
  'indexer_kanban_move_card',
  'reader_save_annotations',
  'plugin_state_set_enabled',
]

function fail(message) {
  console.error(`authorization inventory: ${message}`)
  process.exitCode = 1
}

function functionBody(source, name) {
  const match = new RegExp(`\\b(?:pub\\s+)?(?:async\\s+)?fn\\s+${name}\\s*\\(`).exec(source)
  if (!match) return null
  const opening = source.indexOf('{', match.index)
  if (opening < 0) return null
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
  return null
}

const registry = fs.readFileSync(registryPath, 'utf8')
const authorization = fs.readFileSync(authorizationPath, 'utf8')
const bridgeAuthorization = fs.readFileSync(bridgeAuthorizationPath, 'utf8')

const handler = registry.match(/generate_handler!\s*\[([\s\S]*?)\]\s*\)/)
if (!handler) {
  fail('apps/desktop/src-tauri/src/lib.rs has no tauri::generate_handler! list')
} else {
  const registered = new Set(
    handler[1]
      .replace(/\/\/.*$/gm, '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => entry.split('::').at(-1))
      .filter((entry) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(entry)),
  )
  const classes = new Map()
  const classify = (command, kind) => {
    if (classes.has(command)) fail(`${command} is classified more than once (${classes.get(command)}, ${kind})`)
    classes.set(command, kind)
  }
  for (const [command] of sensitiveCommands) classify(command, 'brokered-sensitive')
  for (const command of readOnlyCommands) classify(command, 'read-only')
  for (const command of localMutationCommands) classify(command, 'local-mutation')

  for (const command of registered) {
    if (!classes.has(command)) fail(`${command} is registered but has no authorization classification`)
  }
  for (const [command, kind] of classes) {
    if (!registered.has(command)) fail(`${command} is classified as ${kind} but is not registered`)
  }
}

for (const [command, relativeFile, variant, wireName] of sensitiveCommands) {
  if (!new RegExp(`\\b${command},`).test(registry)) fail(`${command} is not registered in the Tauri command inventory`)
  const source = fs.readFileSync(path.join(root, relativeFile), 'utf8')
  const body = functionBody(source, command)
  if (!body) {
    fail(`${command} function body could not be located in ${relativeFile}`)
    continue
  }
  if (!body.includes('authorization_token')) fail(`${command} does not accept a one-time authorization token`)
  if (!body.includes('require_sensitive_operation')) fail(`${command} does not consume its authorization token`)
  if (!body.includes(`SensitiveOperation::${variant}`)) {
    fail(`${command} is not bound to SensitiveOperation::${variant}`)
  }
  if (!authorization.includes(`    ${variant},`)) fail(`SensitiveOperation::${variant} is missing from the broker enum`)
  if (!bridgeAuthorization.includes(`'${wireName}'`)) fail(`wire operation ${wireName} is missing from the TypeScript union`)
}

const bridgeSources = fs
  .readdirSync(path.join(root, 'src/bridge/commands'))
  .filter((name) => name.endsWith('.ts'))
  .map((name) => fs.readFileSync(path.join(root, 'src/bridge/commands', name), 'utf8'))
  .join('\n')
for (const [, , , wireName] of sensitiveCommands) {
  const frontendCall = new RegExp(`authorizeSensitiveOperation\\(\\s*['"]${wireName}['"]`)
  if (!frontendCall.test(bridgeSources)) {
    fail(`no frontend bridge requests one-time authorization for ${wireName}`)
  }
}

for (const forbidden of ['keychain_get_secret', 'keychain_set_secret', 'keychain_delete_secret']) {
  if (registry.includes(forbidden)) fail(`generic secret command remains registered: ${forbidden}`)
}

if (!process.exitCode) {
  console.log(
    `Authorization inventory OK: ${sensitiveCommands.length} brokered, ${readOnlyCommands.length} read-only, and ${localMutationCommands.length} local-mutation commands are classified.`,
  )
}
