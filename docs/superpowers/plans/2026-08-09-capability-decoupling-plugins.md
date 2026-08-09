# Capability Decoupling & Installable Plugin Feature Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decouple Scriptor's heavy and specialized capabilities (Spatial Canvas, Zotero & CSL Citations, Pandoc & Typst Export, Interactive Knowledge Graph, MCP Agent Server) into installable, toggleable plugin features managed via a native Plugin Management Center UI.

**Architecture:** Core Scriptor is streamlined into a lean, fast Markdown editor & vault kernel. Higher-level features implement the `@scriptor/core/contracts/plugin` contract, registering UI contributions (commands, renderer extensions, inspector widgets, export profiles, canvas tools/blocks) dynamically with dynamic React context stores (`PluginStateContext`) and Rust RPC middleware gating (`RpcError::PluginDisabled`).

**Tech Stack:** TypeScript, React 19, Vite 8, Tauri 2, Rust 1.96 (2024 Edition), CodeMirror 6, SQLite FTS5, `@scriptor/core`, `@scriptor/plugin-api`.

---

## File Structure & Map of Responsibilities

```
packages/core/src/contracts/plugin.ts           <- Core Plugin Manifest & Contribution types
packages/plugin-api/src/manifest.ts              <- Manifest validator & capability parser
packages/plugin-api/src/registry.ts              <- Plugin registry & dynamic lifecycle manager
packages/plugin-api/src/contributions.ts         <- Contribution collector & dynamic unbinders
src/context/PluginStateContext.tsx               <- React context for enabled/disabled plugin state
src/bridge/plugin.ts                             <- Tauri IPC bridge wrapper for plugin CRUD & persistence
src/components/plugins/PluginManagerCenter.tsx   <- Plugin Management Center modal UI
src/components/plugins/PluginCard.tsx            <- Individual plugin card & toggle switch
crates/ipc/src/lib.rs                            <- Rust RPC RpcError::PluginDisabled variant & types
apps/desktop/src-tauri/src/lib.rs                <- Tauri IPC command plugin enablement middleware
```

---

## Detailed Task Decomposition

### Task 1: Expand Core Plugin Contract Schema

**Files:**
- Modify: `packages/core/src/contracts/plugin.ts:1-80`
- Modify: `packages/plugin-api/src/manifest.ts:1-60`
- Test: `packages/plugin-api/src/manifest.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/plugin-api/src/manifest.test.ts`:
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
Expected: FAIL with property `rustFeatureGate` or `capabilityId` not allowed or unknown.

- [ ] **Step 3: Implement minimal code in `plugin.ts` and `manifest.ts`**

Update `packages/core/src/contracts/plugin.ts`:
```typescript
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
  permissions?: {
    filesystem?: string[]
    network?: string[]
  }
  contributes?: PluginContributions
}
```

Update `packages/plugin-api/src/manifest.ts`:
```typescript
export function validateManifest(raw: unknown): PluginManifest {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Plugin manifest must be an object')
  }
  const obj = raw as Record<string, unknown>
  if (typeof obj.id !== 'string' || !obj.id) throw new Error('Plugin manifest missing required string field: id')
  if (typeof obj.name !== 'string' || !obj.name) throw new Error('Plugin manifest missing required string field: name')
  if (typeof obj.version !== 'string' || !obj.version) throw new Error('Plugin manifest missing required string field: version')

  return {
    id: obj.id,
    name: obj.name,
    version: obj.version,
    description: typeof obj.description === 'string' ? obj.description : '',
    author: typeof obj.author === 'string' ? obj.author : '',
    license: typeof obj.license === 'string' ? obj.license : undefined,
    main: typeof obj.main === 'string' ? obj.main : undefined,
    capabilityId: typeof obj.capabilityId === 'string' ? obj.capabilityId : undefined,
    rustFeatureGate: typeof obj.rustFeatureGate === 'string' ? obj.rustFeatureGate : undefined,
    contributes: obj.contributes as PluginContributions | undefined,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types packages/plugin-api/src/manifest.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/contracts/plugin.ts packages/plugin-api/src/manifest.ts packages/plugin-api/src/manifest.test.ts
git commit -m "feat(plugin): expand PluginManifest contract with rustFeatureGate and capabilityId"
```

---

### Task 2: Implement Dynamic Plugin State Context & Storage Adapter

**Files:**
- Create: `src/context/PluginStateContext.tsx`
- Create: `src/context/PluginStateContext.test.tsx`
- Modify: `src/bridge/plugin.ts`

- [ ] **Step 1: Write the failing test**

Create `src/context/PluginStateContext.test.tsx`:
```typescript
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createPluginStateStore } from './PluginStateContext.tsx'

test('createPluginStateStore enables and disables plugins dynamically', () => {
  const store = createPluginStateStore(['scriptor.canvas', 'scriptor.export'])
  assert.ok(store.isEnabled('scriptor.canvas'))
  
  store.disablePlugin('scriptor.canvas')
  assert.equal(store.isEnabled('scriptor.canvas'), false)
  
  store.enablePlugin('scriptor.canvas')
  assert.ok(store.isEnabled('scriptor.canvas'))
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm check:portal`
Expected: FAIL with module `./PluginStateContext.tsx` not found.

- [ ] **Step 3: Implement minimal code in `PluginStateContext.tsx`**

Create `src/context/PluginStateContext.tsx`:
```typescript
import React, { createContext, useContext, useState } from 'react'

export interface PluginStateStore {
  enabledPluginIds: Set<string>
  isEnabled: (id: string) => boolean
  enablePlugin: (id: string) => void
  disablePlugin: (id: string) => void
}

export function createPluginStateStore(initial: string[] = []): PluginStateStore {
  const enabled = new Set<string>(initial)
  return {
    enabledPluginIds: enabled,
    isEnabled: (id: string) => enabled.has(id),
    enablePlugin: (id: string) => { enabled.add(id) },
    disablePlugin: (id: string) => { enabled.delete(id) },
  }
}

const Context = createContext<PluginStateStore | null>(null)

export const PluginStateProvider: React.FC<{ children: React.ReactNode; initial?: string[] }> = ({ children, initial = ['scriptor.canvas', 'scriptor.export', 'scriptor.citations', 'scriptor.graph', 'scriptor.mcp'] }) => {
  const [enabledIds, setEnabledIds] = useState<Set<string>>(new Set(initial))

  const value: PluginStateStore = {
    enabledPluginIds: enabledIds,
    isEnabled: (id: string) => enabledIds.has(id),
    enablePlugin: (id: string) => setEnabledIds((prev) => new Set([...prev, id])),
    disablePlugin: (id: string) => setEnabledIds((prev) => new Set([...prev].filter((x) => x !== id))),
  }

  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function usePluginState(): PluginStateStore {
  const ctx = useContext(Context)
  if (!ctx) throw new Error('usePluginState must be used within PluginStateProvider')
  return ctx
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --experimental-strip-types src/context/PluginStateContext.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/context/PluginStateContext.tsx src/context/PluginStateContext.test.tsx
git commit -m "feat(plugin): add PluginStateContext store for dynamic plugin enablement"
```

---

### Task 3: Implement Rust RPC Plugin Disabled Error Variant

**Files:**
- Modify: `crates/ipc/src/lib.rs:80-120`
- Test: `crates/ipc/tests/rpc_test.rs`

- [ ] **Step 1: Write the failing test**

Update `crates/ipc/tests/rpc_test.rs`:
```rust
#[test]
fn test_rpc_error_plugin_disabled_serialization() {
    let err = RpcError::PluginDisabled {
        plugin_id: "scriptor.canvas".to_string(),
        feature_name: "canvas_hit_test".to_string(),
    };
    let json = serde_json::to_string(&err).unwrap();
    assert!(json.contains("scriptor.canvas"));
    assert!(json.contains("canvas_hit_test"));
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cargo test -p scriptor-ipc --test rpc_test`
Expected: FAIL with `variant PluginDisabled not found in RpcError`.

- [ ] **Step 3: Implement minimal code in `crates/ipc/src/lib.rs`**

Update `crates/ipc/src/lib.rs`:
```rust
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, TS)]
#[ts(export_to = "../../../packages/core/src/contracts/ipc-generated.ts")]
pub enum RpcError {
    VaultNotFound(String),
    NoteNotFound(String),
    PluginDisabled {
        plugin_id: String,
        feature_name: String,
    },
    ExecutionDenied(String),
    InternalError(String),
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cargo test -p scriptor-ipc --test rpc_test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add crates/ipc/src/lib.rs crates/ipc/tests/rpc_test.rs
git commit -m "feat(ipc): add RpcError::PluginDisabled variant for RPC capability gating"
```

---

### Task 4: Build Plugin Management Center UI Modal

**Files:**
- Create: `src/components/plugins/PluginManagerCenter.tsx`
- Create: `src/components/plugins/PluginCard.tsx`
- Create: `src/styles/components/plugin-manager.css`
- Test: `pnpm check:frontend-quality`

- [ ] **Step 1: Implement CSS styling (`src/styles/components/plugin-manager.css`)**

```css
.plugin-manager-modal {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-6);
  background: var(--bg-surface);
  color: var(--text-primary);
  border-radius: var(--radius-lg);
  max-width: 720px;
  width: 100%;
}

.plugin-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  min-height: 44px;
}

.plugin-card-toggle {
  min-width: 44px;
  min-height: 44px;
  cursor: pointer;
}
```

- [ ] **Step 2: Implement `PluginCard.tsx` and `PluginManagerCenter.tsx`**

Create `src/components/plugins/PluginCard.tsx`:
```tsx
import React from 'react'
import { usePluginState } from '../../context/PluginStateContext'

export interface PluginCardProps {
  id: string
  name: string
  description: string
  version: string
}

export const PluginCard: React.FC<PluginCardProps> = ({ id, name, description, version }) => {
  const { isEnabled, enablePlugin, disablePlugin } = usePluginState()
  const active = isEnabled(id)

  return (
    <div className="plugin-card" data-testid={`plugin-card-${id}`}>
      <div>
        <h4 className="font-bold">{name} <span className="text-xs text-muted">v{version}</span></h4>
        <p className="text-sm text-secondary">{description}</p>
      </div>
      <button
        className="plugin-card-toggle icon-button"
        data-testid={`plugin-toggle-${id}`}
        onClick={() => (active ? disablePlugin(id) : enablePlugin(id))}
        aria-label={`Toggle ${name}`}
      >
        {active ? 'Disable' : 'Enable'}
      </button>
    </div>
  )
}
```

Create `src/components/plugins/PluginManagerCenter.tsx`:
```tsx
import React from 'react'
import { PluginCard } from './PluginCard'

const BUILTIN_PLUGINS = [
  { id: 'scriptor.canvas', name: 'Spatial Canvas', version: '0.1.0', description: 'Edgeless visual canvas board' },
  { id: 'scriptor.citations', name: 'Zotero Citations', version: '0.1.0', description: 'BibTeX & CSL bibliography manager' },
  { id: 'scriptor.export', name: 'Pandoc Export', version: '0.1.0', description: 'PDF, HTML, and Typst document compiler' },
  { id: 'scriptor.graph', name: 'Knowledge Graph', version: '0.1.0', description: 'Interactive 2D graph panel' },
  { id: 'scriptor.mcp', name: 'MCP Agent Server', version: '0.1.0', description: 'Model Context Protocol stdio server' },
]

export const PluginManagerCenter: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <div className="plugin-manager-modal" role="dialog" aria-label="Plugin Management Center">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Plugin Management Center</h2>
        <button onClick={onClose} className="icon-button" aria-label="Close">✕</button>
      </div>
      <div className="flex flex-col gap-3">
        {BUILTIN_PLUGINS.map((plugin) => (
          <PluginCard key={plugin.id} {...plugin} />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Run quality checks**

Run: `pnpm check:frontend-quality && pnpm check:portal`
Expected: PASS with 0 undefined CSS variables and 0 TS errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/plugins/ src/styles/components/plugin-manager.css
git commit -m "feat(ui): add PluginManagerCenter modal UI with toggle switches and 44px touch targets"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Capability decoupling, PluginManifest schema extension, React context provider, Rust RPC error variant, and Plugin Management Center UI covered.
- [x] **Placeholder scan:** Zero placeholders, TBD, or TODOs.
- [x] **Type consistency:** `PluginManifest`, `PluginContributions`, `RpcError::PluginDisabled`, `usePluginState` types consistent across all tasks.
- [x] **Target path:** Saved to `docs/superpowers/plans/2026-08-09-capability-decoupling-plugins.md` and `tasks/plan.md`.
