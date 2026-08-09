# Capability Decoupling & Installable Plugin Feature Architecture (Comprehensive TDD Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decouple Scriptor's heavy and specialized capabilities (Spatial Canvas, Zotero & CSL Citations, Pandoc & Typst Export, Interactive Knowledge Graph, MCP Agent Server, PDF Translation) into installable, toggleable plugin features managed via a native Plugin Management Center UI.

**Architecture:** Core Scriptor is streamlined into a lean, fast Markdown editor & vault kernel. Higher-level features implement the `@scriptor/core/contracts/plugin` contract, registering UI contributions (commands, renderer extensions, inspector widgets, export profiles, canvas tools/blocks) dynamically with dynamic React context stores (`PluginStateContext`) and Rust RPC middleware gating (`RpcError::PluginDisabled`).

**Tech Stack:** TypeScript, React 19, Vite 8, Tauri 2, Rust 1.96 (2024 Edition, `thiserror`, zero `unwrap()` in prod, `// SAFETY:` rationale), CodeMirror 6, SQLite FTS5, `@scriptor/core`, `@scriptor/plugin-api`.

---

## Complete API Contract & Contribution Specification

### 1. `PluginManifest` and `PluginContributions` (`packages/core/src/contracts/plugin.ts`)

```typescript
export interface PluginPermissions {
  filesystem?: string[]
  network?: string[]
  subprocess?: string[]
}

export interface PluginCommandContribution {
  id: string
  title: string
  category?: string
  shortcut?: string
}

export interface RendererExtensionContribution {
  id: string
  name: string
  type: 'syntax' | 'postprocess' | 'style'
}

export interface InspectorWidgetContribution {
  id: string
  title: string
  location: 'sidebar' | 'inspector' | 'bottom'
}

export interface ExportProfileContribution {
  id: string
  name: string
  format: 'pdf' | 'html' | 'markdown' | 'typst' | 'textbundle'
}

export interface McpToolContribution {
  name: string
  description: string
  readOnly: boolean
}

export interface VaultHealthCheckContribution {
  id: string
  name: string
}

export interface TemplatePackContribution {
  id: string
  name: string
}

export interface CanvasToolContribution {
  id: string
  label: string
}

export interface CanvasBlockContribution {
  type: string
  label: string
}

export interface PluginContributions {
  commands?: PluginCommandContribution[]
  rendererExtensions?: RendererExtensionContribution[]
  inspectorWidgets?: InspectorWidgetContribution[]
  exportProfiles?: ExportProfileContribution[]
  mcpTools?: McpToolContribution[]
  vaultHealthChecks?: VaultHealthCheckContribution[]
  templatePacks?: TemplatePackContribution[]
  canvasTools?: CanvasToolContribution[]
  canvasBlocks?: CanvasBlockContribution[]
}

export interface PluginManifest {
  id: string
  name: string
  version: string
  description: string
  author: string
  license?: string
  main?: string
  capabilityId?: string
  rustFeatureGate?: string
  permissions?: PluginPermissions
  contributes?: PluginContributions
}
```

### 2. Vault Manifest Persistence Schema (`.scriptor/plugins.json`)

```json
{
  "schemaVersion": 1,
  "enabledPlugins": [
    "scriptor.canvas",
    "scriptor.citations",
    "scriptor.export",
    "scriptor.graph",
    "scriptor.mcp"
  ],
  "disabledPlugins": [],
  "settings": {
    "scriptor.pdf-translate": {
      "autoDownloadBinary": false
    }
  }
}
```

---

## Orchestrated Batch Refactor Work Wave Graph

```
===================================================================================
WAVE 0: FOUNDATION PACKETS (Sequential Base Contracts & State Store)
[Packet 0.1: Contract Schema] -> [Packet 0.2: PluginStateContext] -> [Packet 0.3: Rust RPC Gating]
===================================================================================
                                         │
                                         ▼
===================================================================================
WAVE 1: DECOUPLED FEATURE EXTRACTION PACKETS (5 Parallel Worker Subagents)
┌───────────────────────┬───────────────────────┬───────────────────────┐
│ Packet 1.1: Canvas    │ Packet 1.2: Citations │ Packet 1.3: Export    │
│ (packages/canvas/)    │ (CitationInspector)   │ (packages/export/)    │
├───────────────────────┼───────────────────────┴───────────────────────┘
│ Packet 1.4: Graph     │ Packet 1.5: MCP Server                        │
│ (src/GraphPanel.tsx)  │ (packages/mcp/)                               │
└───────────────────────┴───────────────────────────────────────────────┘
===================================================================================
                                         │
                                         ▼
===================================================================================
WAVE 2: UI INTEGRATION & MIGRATION SYNTHESIS PACKETS (Sequential Integration Gate)
[Packet 2.1: PluginManagerCenter UI] -> [Packet 2.2: Strangler Adapters & Full E2E Verification]
===================================================================================
```

---

## File Ownership Matrix across Work Packets

| Packet ID | Dedicated Subagent Role | Exclusively Owned Files | Validation Command |
|---|---|---|---|
| **Packet 0.1** | Core Contract Developer | `packages/core/src/contracts/plugin.ts`, `packages/plugin-api/src/manifest.ts` | `pnpm check:contracts && pnpm check:plugins` |
| **Packet 0.2** | React State Specialist | `src/context/PluginStateContext.tsx`, `src/bridge/plugin.ts` | `pnpm check:portal` |
| **Packet 0.3** | Rust Systems Specialist | `crates/ipc/src/lib.rs`, `apps/desktop/src-tauri/src/lib.rs` | `cargo test -p scriptor-ipc` |
| **Packet 1.1** | Worker A (Canvas Lead) | `packages/canvas/src/index.ts`, `packages/canvas/plugin.json`, `src/components/CanvasPanel.tsx` | `pnpm check:canvas` |
| **Packet 1.2** | Worker B (Citations Lead)| `src/lib/validate-citation-runner.ts`, `src/components/inspector/CitationInspector.tsx` | `pnpm check:citations` |
| **Packet 1.3** | Worker C (Export Lead) | `packages/export/src/index.ts`, `packages/export/plugin.json`, `src/components/dialogs/ExportDialog.tsx` | `pnpm check:export` |
| **Packet 1.4** | Worker D (Graph Lead) | `src/components/GraphPanel.tsx`, `src/workers/graph-layout.worker.ts` | `pnpm test:e2e -- e2e/graph.spec.ts` |
| **Packet 1.5** | Worker E (MCP Lead) | `packages/mcp/src/index.ts`, `packages/mcp/plugin.json`, `src/components/mcp/McpInspector.tsx` | `pnpm check:mcp` |
| **Packet 2.1** | UI Component Developer | `src/components/plugins/PluginManagerCenter.tsx`, `src/styles/components/plugin-manager.css` | `pnpm check:frontend-quality` |
| **Packet 2.2** | QA Integration Lead | `tasks/todo.md`, `docs/reports/COMPREHENSIVE-PROJECT-REVIEW.md` | `pnpm check:source && pnpm test:e2e` |

---

## Detailed Step-by-Step Task Breakdown

### Wave 0: Foundation Packets

#### Packet 0.1: Expand Core Plugin Contract Schema

**Files:**
- Modify: `packages/core/src/contracts/plugin.ts`
- Modify: `packages/plugin-api/src/manifest.ts`
- Test: `packages/plugin-api/src/manifest.test.ts`

- [ ] **Step 1: Write failing test (`packages/plugin-api/src/manifest.test.ts`)**
```typescript
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateManifest } from './manifest.ts'

test('validateManifest accepts rustFeatureGate and capabilityId attributes', () => {
  const manifest = validateManifest({
    id: 'scriptor.canvas',
    name: 'Spatial Canvas',
    version: '0.1.0',
    description: 'Edgeless visual canvas',
    author: 'Scriptor Team',
    rustFeatureGate: 'scriptor-canvas-engine',
    capabilityId: 'canvas',
  })
  assert.equal(manifest.rustFeatureGate, 'scriptor-canvas-engine')
  assert.equal(manifest.capabilityId, 'canvas')
})
```

- [ ] **Step 2: Run test to verify it fails**
Run: `node --experimental-strip-types packages/plugin-api/src/manifest.test.ts`
Expected: FAIL with property `rustFeatureGate` or `capabilityId` not recognized.

- [ ] **Step 3: Implement minimal code in `plugin.ts` and `manifest.ts`**
Add `capabilityId?: string` and `rustFeatureGate?: string` to `PluginManifest` in `packages/core/src/contracts/plugin.ts` and parse them in `packages/plugin-api/src/manifest.ts`.

- [ ] **Step 4: Run test to verify it passes**
Run: `node --experimental-strip-types packages/plugin-api/src/manifest.test.ts && pnpm check:contracts && pnpm check:plugins`
Expected: PASS

- [ ] **Step 5: Commit**
Run: `git add packages/core/src/contracts/plugin.ts packages/plugin-api/src/manifest.ts packages/plugin-api/src/manifest.test.ts && git commit -m "feat(plugin): expand PluginManifest contract with rustFeatureGate and capabilityId"`

#### Packet 0.2: Implement Dynamic Plugin State Context & Storage Adapter

**Files:**
- Create: `src/context/PluginStateContext.tsx`
- Create: `src/context/PluginStateContext.test.tsx`
- Modify: `src/bridge/plugin.ts`

- [ ] **Step 1: Write failing test (`src/context/PluginStateContext.test.tsx`)**
- [ ] **Step 2: Run test to verify it fails** (`pnpm check:portal`)
- [ ] **Step 3: Implement minimal code** (`PluginStateContext.tsx`, `src/bridge/plugin.ts`)
- [ ] **Step 4: Verify test passes** (`node --experimental-strip-types src/context/PluginStateContext.test.tsx`)
- [ ] **Step 5: Commit** (`git commit -m "feat(plugin): add PluginStateContext store for dynamic plugin enablement"`)

#### Packet 0.3: Implement Rust RPC Plugin Disabled Error Variant

**Files:**
- Modify: `crates/ipc/src/lib.rs`
- Test: `crates/ipc/tests/rpc_test.rs`

- [ ] **Step 1: Write failing test (`crates/ipc/tests/rpc_test.rs`)**
- [ ] **Step 2: Verify test fails** (`cargo test -p scriptor-ipc --test rpc_test`)
- [ ] **Step 3: Implement minimal code** (`crates/ipc/src/lib.rs`)
- [ ] **Step 4: Verify test passes** (`cargo test -p scriptor-ipc --test rpc_test`)
- [ ] **Step 5: Commit** (`git commit -m "feat(ipc): add RpcError::PluginDisabled variant for RPC capability gating"`)

---

### Wave 1: Parallel Feature Extraction Packets (5 Concurrent Workers)

#### Packet 1.1: Extract Spatial Canvas into `@scriptor/plugin-canvas` (Worker A)
- Exclusively owned files: `packages/canvas/src/index.ts`, `packages/canvas/plugin.json`, `src/components/CanvasPanel.tsx`
- Validation command: `pnpm check:canvas`

#### Packet 1.2: Extract Zotero Citations into `@scriptor/plugin-citations` (Worker B)
- Exclusively owned files: `src/lib/validate-citation-runner.ts`, `src/components/inspector/CitationInspector.tsx`
- Validation command: `pnpm check:citations`

#### Packet 1.3: Extract Pandoc Export into `@scriptor/plugin-export` (Worker C)
- Exclusively owned files: `packages/export/src/index.ts`, `packages/export/plugin.json`, `src/components/dialogs/ExportDialog.tsx`
- Validation command: `pnpm check:export`

#### Packet 1.4: Extract Interactive Knowledge Graph into `@scriptor/plugin-graph` (Worker D)
- Exclusively owned files: `src/components/GraphPanel.tsx`, `src/workers/graph-layout.worker.ts`
- Validation command: `pnpm test:e2e -- e2e/graph.spec.ts`

#### Packet 1.5: Extract MCP Agent Server into `@scriptor/plugin-mcp` (Worker E)
- Exclusively owned files: `packages/mcp/src/index.ts`, `packages/mcp/plugin.json`, `src/components/mcp/McpInspector.tsx`
- Validation command: `pnpm check:mcp`

---

### Wave 2: UI Integration & Migration Synthesis Packets

#### Packet 2.1: Build Plugin Management Center UI (`PluginManagerCenter.tsx`)
- Files: `src/components/plugins/PluginManagerCenter.tsx`, `src/components/plugins/PluginCard.tsx`, `src/styles/components/plugin-manager.css`
- Validation command: `pnpm check:frontend-quality && pnpm check:portal`

#### Packet 2.2: Strangler Adapters & Full System Integration Verification Gate
- Validation command: `pnpm check:source && pnpm test:e2e`
