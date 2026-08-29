#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const SURFACES = new Set(['tauri', 'daemon-rpc', 'mcp', 'cli'])
const REQUIRED_OUTCOMES = new Set(['value', 'absent-optional', 'invalid', 'degraded', 'failed', 'recovered'])

export function loadOperationCatalog(root) {
  return JSON.parse(fs.readFileSync(path.join(root, 'contracts/operations.json'), 'utf8'))
}

export function validateOperationCatalog(catalog) {
  if (catalog?.schema !== 'scriptor.operation-catalog.v1' || catalog?.schemaVersion !== 1) {
    throw new Error('unsupported operation catalog schema')
  }
  const definedOutcomes = new Set(Object.keys(catalog.boundaryOutcomes ?? {}))
  for (const required of REQUIRED_OUTCOMES) if (!definedOutcomes.has(required)) throw new Error(`missing boundary outcome definition: ${required}`)
  if (!Array.isArray(catalog.operations) || catalog.operations.length === 0) throw new Error('operation catalog has no operations')
  const keys = new Set()
  for (const operation of catalog.operations) {
    if (!SURFACES.has(operation.surface)) throw new Error(`unsupported operation surface: ${operation.surface}`)
    if (!operation.name || !operation.owner || !operation.authorizationClass || !operation.mutationClass || !operation.schemaKind) {
      throw new Error(`operation metadata incomplete: ${operation.surface}/${operation.name ?? '<missing>'}`)
    }
    const key = `${operation.surface}\0${operation.name}`
    if (keys.has(key)) throw new Error(`duplicate operation: ${operation.surface}/${operation.name}`)
    keys.add(key)
    if (!Array.isArray(operation.outcomePolicy) || operation.outcomePolicy.length === 0) throw new Error(`operation has no outcome policy: ${operation.name}`)
    for (const outcome of operation.outcomePolicy) if (!definedOutcomes.has(outcome)) throw new Error(`unknown outcome ${outcome}: ${operation.name}`)
    if (operation.surface === 'mcp' && operation.schemaKind === 'json-schema' && (!operation.inputSchema || operation.inputSchema.type !== 'object')) {
      throw new Error(`MCP operation has no object input schema: ${operation.name}`)
    }
    if (operation.surface === 'tauri' && operation.authorizationClass === 'brokered-sensitive') {
      if (!operation.authorizationVariant || !operation.scope) throw new Error(`sensitive Tauri operation lacks broker metadata: ${operation.name}`)
    }
  }
  return catalog
}

export function discoverTauriCommands(root) {
  const source = fs.readFileSync(path.join(root, 'apps/desktop/src-tauri/src/lib.rs'), 'utf8')
  const handler = source.match(/generate_handler!\s*\[([\s\S]*?)\]\s*\)/)
  if (!handler) throw new Error('Tauri generate_handler inventory not found')
  return handler[1]
    .replace(/\/\/.*$/gm, '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => entry.split('::').at(-1))
    .filter((entry) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(entry))
}

function enumBody(source, enumName) {
  const match = new RegExp(`\\benum\\s+${enumName}\\s*\\{`).exec(source)
  if (!match) throw new Error(`Rust enum not found: ${enumName}`)
  const start = source.indexOf('{', match.index) + 1
  let depth = 0
  let quote = null
  let escaped = false
  let lineComment = false
  let blockCommentDepth = 0
  const segments = []
  let current = ''
  for (let index = start; index < source.length; index += 1) {
    const char = source[index]
    const next = source[index + 1] ?? ''
    if (lineComment) {
      if (char === '\n') { lineComment = false; current += char }
      continue
    }
    if (blockCommentDepth > 0) {
      if (char === '/' && next === '*') { blockCommentDepth += 1; index += 1 }
      else if (char === '*' && next === '/') { blockCommentDepth -= 1; index += 1 }
      continue
    }
    if (quote) {
      current += char
      if (escaped) escaped = false
      else if (char === '\\') escaped = true
      else if (char === quote) quote = null
      continue
    }
    if (char === '/' && next === '/') { lineComment = true; index += 1; continue }
    if (char === '/' && next === '*') { blockCommentDepth = 1; index += 1; continue }
    if (char === '"' || char === "'") { quote = char; current += char; continue }
    if (char === '{' || char === '(' || char === '[') { depth += 1; current += char; continue }
    if (char === '}' || char === ')' || char === ']') {
      if (char === '}' && depth === 0) {
        if (current.trim()) segments.push(current)
        return segments
      }
      depth -= 1
      current += char
      continue
    }
    if (char === ',' && depth === 0) { segments.push(current); current = ''; continue }
    current += char
  }
  throw new Error(`unterminated Rust enum: ${enumName}`)
}

export function discoverRustEnumVariants(file, enumName) {
  const segments = enumBody(fs.readFileSync(file, 'utf8'), enumName)
  return segments.map((segment) => segment.match(/\b([A-Z][A-Za-z0-9_]*)\b/)?.[1]).filter(Boolean)
}

export function discoverMcpToolNames(root) {
  const source = fs.readFileSync(path.join(root, 'packages/mcp/src/tool-contracts.ts'), 'utf8')
  return [...source.matchAll(/\bname:\s*'(mcp\.[^']+)'/g)].map((match) => match[1])
}

function prettyJson(value) { return `${JSON.stringify(value, null, 2)}\n` }

function typescriptCatalog(catalog) {
  return `// GENERATED from contracts/operations.json. Do not edit by hand.\nexport const OPERATION_CATALOG = ${JSON.stringify(catalog, null, 2)} as const\n\nexport type OperationCatalog = typeof OPERATION_CATALOG\nexport type OperationCatalogEntry = OperationCatalog['operations'][number]\nexport type OperationSurface = OperationCatalogEntry['surface']\nexport type BoundaryOutcomeStatus = keyof OperationCatalog['boundaryOutcomes']\n`
}

function typescriptMcpSchemas(catalog) {
  const schemas = Object.fromEntries(catalog.operations.filter((operation) => operation.surface === 'mcp').map((operation) => [operation.name, operation.inputSchema]))
  return `// GENERATED from contracts/operations.json. Do not edit by hand.\nimport type { McpJsonSchema } from '@scriptor/core/contracts/mcp'\n\nexport const MCP_TOOL_INPUT_SCHEMAS: Record<string, McpJsonSchema> = ${JSON.stringify(schemas, null, 2)}\n`
}

function rustOperationCatalog(catalog) {
  const rpc = catalog.operations.filter((operation) => operation.surface === 'daemon-rpc')
  const entries = rpc.map((operation) => {
    const name = operation.name.slice(4)
    const outcomes = operation.outcomePolicy.map((item) => `"${item}"`)
    const singleLine = `    ("${name}", &[${outcomes.join(', ')}]),`
    if (singleLine.length <= 66) return singleLine

    const compactOutcomes = `        &[${outcomes.join(', ')}],`
    if (compactOutcomes.length <= 66) {
      return `    (\n        "${name}",\n${compactOutcomes}\n    ),`
    }

    return `    (\n        "${name}",\n        &[\n${outcomes.map((outcome) => `            ${outcome},`).join('\n')}\n        ],\n    ),`
  }).join('\n')
  return `// GENERATED from contracts/operations.json. Do not edit by hand.\n/// Daemon RPC operation names and their allowed boundary outcomes.\npub const RPC_OPERATION_CATALOG: &[(&str, &[&str])] = &[\n${entries}\n];\n`
}

export function renderGeneratedArtifacts(catalog, _root) {
  validateOperationCatalog(catalog)
  const mcpSchemas = Object.fromEntries(catalog.operations.filter((operation) => operation.surface === 'mcp').map((operation) => [operation.name, operation.inputSchema]))
  const tauri = catalog.operations.filter((operation) => operation.surface === 'tauri').map((operation) => ({
    name: operation.name,
    owner: operation.owner,
    authorizationClass: operation.authorizationClass,
    mutationClass: operation.mutationClass,
    scope: operation.scope ?? null,
    authorizationVariant: operation.authorizationVariant ?? null,
    outcomePolicy: operation.outcomePolicy,
  }))
  return {
    'contracts/mcp-tool-schemas.generated.json': prettyJson(mcpSchemas),
    'packages/core/src/contracts/operation-catalog.generated.ts': typescriptCatalog(catalog),
    'packages/mcp/src/tool-schemas.generated.ts': typescriptMcpSchemas(catalog),
    'scripts/validation/authorization-inventory.generated.json': prettyJson({ schemaVersion: 1, commands: tauri }),
    'crates/ipc/src/operation_catalog_generated.rs': rustOperationCatalog(catalog),
  }
}

export function assertLiveParity(catalog, root) {
  const bySurface = (surface) => catalog.operations.filter((operation) => operation.surface === surface).map((operation) => operation.name).sort()
  const compare = (label, expected, actual) => {
    if (JSON.stringify(expected) !== JSON.stringify(actual)) throw new Error(`${label} operation catalog is out of sync with live source`)
  }
  compare('Tauri', bySurface('tauri'), discoverTauriCommands(root).sort())
  compare('daemon RPC', bySurface('daemon-rpc'), discoverRustEnumVariants(path.join(root, 'crates/ipc/src/lib.rs'), 'RpcMethod').map((name) => `rpc.${name}`).sort())
  compare('CLI', bySurface('cli'), discoverRustEnumVariants(path.join(root, 'crates/cli/src/command_line.rs'), 'Commands').map((name) => `cli.${name}`).sort())
  compare('MCP', bySurface('mcp'), [...new Set(discoverMcpToolNames(root))].sort())
}

function main(argv) {
  const root = path.resolve(import.meta.dirname, '../..')
  const catalog = validateOperationCatalog(loadOperationCatalog(root))
  assertLiveParity(catalog, root)
  const rendered = renderGeneratedArtifacts(catalog, root)
  const check = argv.includes('--check')
  let stale = false
  for (const [relative, contents] of Object.entries(rendered)) {
    const target = path.join(root, relative)
    if (check) {
      if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== contents) {
        console.error(`stale generated operation contract: ${relative}`)
        stale = true
      }
    } else {
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, contents)
      console.log(relative)
    }
  }
  if (stale) process.exitCode = 1
}

const invoked = process.argv[1] ? path.resolve(process.argv[1]) : null
if (invoked === fileURLToPath(import.meta.url)) main(process.argv.slice(2))
