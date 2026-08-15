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
  ['vault_publish_starlight', 'apps/desktop/src-tauri/src/commands/code_chunk.rs', 'PublishSite', 'publish_site'],
  ['vault_restore_backup', 'apps/desktop/src-tauri/src/commands/backup.rs', 'RestoreBackup', 'restore_backup'],
  ['vault_restore_note_history_revision', 'apps/desktop/src-tauri/src/commands/history.rs', 'RestoreHistory', 'restore_history'],
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
  console.log(`Authorization inventory OK: ${sensitiveCommands.length} high-impact command bindings are brokered and frontend-authorized.`)
}
