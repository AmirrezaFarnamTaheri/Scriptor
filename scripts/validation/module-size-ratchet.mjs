#!/usr/bin/env node
import { readFileSync } from 'node:fs'

const limits = new Map([
  ['src/App.tsx', 1950],
  ['src/components/SettingsPanel.tsx', 650],
  ['packages/mcp/src/runtime.ts', 575],
  ['crates/daemon/src/command_gateway.rs', 875],
  ['crates/daemon/src/transport.rs', 700],
  ['crates/cli/src/main.rs', 650],
])

const requiredOwners = [
  'src/controllers/deleteNoteController.ts',
  'src/hooks/useAppJourneyTelemetry.ts',
  'src/hooks/useAppKeyboardShortcuts.ts',
  'src/hooks/useVaultSidebarActions.ts',
  'src/hooks/useWorkspaceAuxiliaryData.ts',
  'src/components/VaultConfigSettingsSection.tsx',
  'src/components/app/QuickCaptureWorkspaceLayer.tsx',
  'src/components/app/WorkspaceRenameDialogs.tsx',
  'packages/mcp/src/tool-contracts.ts',
  'crates/daemon/src/command_gateway/catalog.rs',
  'crates/cli/src/command_line.rs',
  'packages/mcp/src/runtime-tests.ts',
  'crates/daemon/src/command_gateway/support.rs',
  'crates/daemon/src/transport/tests.rs',
  'crates/cli/src/bench.rs',
]

const failures = []
for (const [path, limit] of limits) {
  const lines = readFileSync(path, 'utf8').split(/\r?\n/).length
  if (lines > limit) failures.push(`${path}: ${lines} lines exceeds ratchet ${limit}`)
}
for (const path of requiredOwners) {
  try {
    const body = readFileSync(path, 'utf8').trim()
    if (!body) failures.push(`${path}: ownership module is empty`)
  } catch {
    failures.push(`${path}: required ownership module is missing`)
  }
}

if (failures.length) {
  console.error('Module-size/ownership ratchet failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log(`Module-size/ownership ratchet OK: ${limits.size} hotspots bounded, ${requiredOwners.length} domain owners present.`)
