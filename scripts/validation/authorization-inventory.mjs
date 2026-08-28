import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const registryPath = path.join(root, 'apps/desktop/src-tauri/src/lib.rs')
const authorizationPath = path.join(root, 'apps/desktop/src-tauri/src/authorization.rs')
const bridgeAuthorizationPath = path.join(root, 'src/bridge/commands/authorization.ts')

const generatedInventoryPath = path.join(root, 'scripts/validation/authorization-inventory.generated.json')
const generatedInventory = JSON.parse(fs.readFileSync(generatedInventoryPath, 'utf8'))
if (generatedInventory.schemaVersion !== 1 || !Array.isArray(generatedInventory.commands)) {
  throw new Error('unsupported generated authorization inventory')
}
const sensitiveCommands = generatedInventory.commands
  .filter((command) => command.authorizationClass === 'brokered-sensitive')
  .map((command) => [command.name, command.owner, command.authorizationVariant, command.scope])
const readOnlyCommands = generatedInventory.commands
  .filter((command) => command.authorizationClass === 'read-only')
  .map((command) => command.name)
const localMutationCommands = generatedInventory.commands
  .filter((command) => command.authorizationClass === 'local-mutation')
  .map((command) => command.name)

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
