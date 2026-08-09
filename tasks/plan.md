# Implementation Plan: Capability Decoupling & Installable Plugin Feature Architecture

## Overview
This plan establishes a modular, plugin-first architecture for Scriptor. Core Scriptor is streamlined into a lean, fast Markdown editor & vault kernel, while specialized capabilities (**Spatial Canvas**, **Zotero & CSL Citations**, **Pandoc & Typst Export**, **Interactive Knowledge Graph**, **PDF Translation (`pdf2zh`)**, **MCP Agent Server**, and **Local Semantic Embeddings**) are decoupled into installable, toggleable plugin features. Users can dynamically discover, install, enable, disable, and uninstall capabilities via a native Plugin Management Center UI.

---

## Architecture Decisions

1. **Kernel vs. Plugin Capability Boundary:**
   - **Scriptor Core (Lean Kernel):** Markdown Vault I/O, CodeMirror 6 Editor, Base Indexing & SQLite FTS5, Command Palette, Core IPC Bridge, Settings & Plugin Management Center UI.
   - **Decoupled Plugin Packages:**
     - `@scriptor/plugin-canvas`: Infinite spatial canvas, node hit-testing, `.canvas` file handler, canvas tools & block contributions.
     - `@scriptor/plugin-citations`: Zotero CSL JSON sync, BibTeX extraction, Pandoc citeproc formatting, reference inspector widget.
     - `@scriptor/plugin-export`: Pandoc PDF/HTML export engine, Typst compiler, Reveal.js slides, TextBundle export, Starlight static site publisher.
     - `@scriptor/plugin-graph`: Interactive knowledge graph panel, 2D Canvas force-directed layout worker, backlinks & orphan note inspector.
     - `@scriptor/plugin-pdf-translate`: Layout-preserving scientific PDF translation via `pdf2zh`.
     - `@scriptor/plugin-mcp`: Model Context Protocol stdio server, patch queue, tool permissions & audit log.
     - `@scriptor/plugin-embeddings`: Local vector search, semantic embeddings, AI note similarity.

2. **Dynamic UI Contribution & Extension Engine:**
   - Extend `packages/plugin-api` (`collectContributions`) to dynamically inject/remove navigation tabs, sidebar panels, command palette actions, inspector widgets, and CodeMirror extensions when plugins are enabled or disabled without requiring full app reloads.

3. **Rust Capability Gating & RPC Error Contracts:**
   - Update `crates/ipc` and `apps/desktop/src-tauri` handlers to validate plugin enablement state. Invoking an uninstalled or disabled plugin feature returns `RpcError::PluginDisabled { plugin_id, feature_name }`.

4. **Vault & User Plugin Manifest Persistence:**
   - Store plugin state in `.scriptor/plugins.json` (per-vault) and `user-settings.json` (global defaults). Enable seamless offline installation from local `.tar.gz` / `.zip` plugin bundles or NPM package registry.

---

## Task List & Implementation Phases

### Phase 1: Plugin Architecture Foundation & Dynamic Contribution Engine

- [ ] **Task 1.1: Core Plugin Contract & Capability Schema Expansion**
  - **Description:** Expand `@scriptor/core/contracts/plugin` and `packages/plugin-api/src/manifest.ts` to include explicit `capabilityId`, `lazyLoad`, `rustFeatureGate`, and `permissions` attributes in `PluginManifest`.
  - **Acceptance criteria:**
    - [ ] `PluginManifest` schema updated with `capabilities` and `rustFeatureGate` fields.
    - [ ] `pnpm check:contracts` and `pnpm check:plugins` pass.
  - **Verification:** `pnpm check:contracts && pnpm check:plugins`
  - **Dependencies:** None
  - **Files likely touched:** `packages/core/src/contracts/plugin.ts`, `packages/plugin-api/src/manifest.ts`, `packages/plugin-api/src/registry.ts`

- [ ] **Task 1.2: Dynamic Context Store & Plugin State Provider**
  - **Description:** Implement `PluginStateContext` in React (`src/context/PluginStateContext.tsx`) to manage active plugin manifests, toggle enablement, and emit contribution updates.
  - **Acceptance criteria:**
    - [ ] `PluginStateContext` provides `enabledPluginIds`, `enablePlugin(id)`, `disablePlugin(id)`, `installPlugin(pkg)`.
    - [ ] Active plugin state persists to `localStorage` and `.scriptor/plugins.json`.
  - **Verification:** `pnpm test:unit`
  - **Dependencies:** Task 1.1
  - **Files likely touched:** `src/context/PluginStateContext.tsx`, `src/bridge/plugin.ts`

### Checkpoint: Foundation
- [ ] `pnpm check:plugins` and `pnpm check:contracts` pass cleanly.

---

### Phase 2: Feature Decoupling & Modular Extraction

- [ ] **Task 2.1: Extract Spatial Canvas into `@scriptor/plugin-canvas`**
  - **Description:** Decouple `CanvasPanel.tsx`, `CanvasStage.tsx`, and `useCanvasBoard` into `@scriptor/plugin-canvas`, registering canvas command palette items and `.canvas` file icon handlers via plugin contributions.
  - **Acceptance criteria:**
    - [ ] Canvas UI and commands load only when `@scriptor/plugin-canvas` is active.
    - [ ] Disabling canvas plugin cleanly hides canvas panel & toolbar options.
  - **Verification:** `pnpm check:canvas && pnpm test:e2e -- e2e/canvas.spec.ts`
  - **Dependencies:** Task 1.2
  - **Files likely touched:** `packages/canvas/src/index.ts`, `src/components/CanvasPanel.tsx`, `src/App.tsx`

- [ ] **Task 2.2: Extract Zotero & Citation Engine into `@scriptor/plugin-citations`**
  - **Description:** Decouple `CitationInspector.tsx`, CSL parsing, and BibTeX extraction into `@scriptor/plugin-citations`.
  - **Acceptance criteria:**
    - [ ] Citation inspector widget and citeproc commands load via `contributes.inspectorWidgets`.
    - [ ] Disabling citation plugin unmounts Zotero sync options.
  - **Verification:** `pnpm check:citations`
  - **Dependencies:** Task 1.2
  - **Files likely touched:** `src/lib/validate-citation-runner.ts`, `src/components/inspector/CitationInspector.tsx`

- [ ] **Task 2.3: Extract Export & Publishing Engine into `@scriptor/plugin-export`**
  - **Description:** Decouple Pandoc/Typst export options, Reveal.js slides, and Starlight publisher into `@scriptor/plugin-export`.
  - **Acceptance criteria:**
    - [ ] Export profiles registered dynamically via `contributes.exportProfiles`.
    - [ ] Export dialog shows only active plugin profile options.
  - **Verification:** `pnpm check:export`
  - **Dependencies:** Task 1.2
  - **Files likely touched:** `packages/export/src/index.ts`, `src/components/dialogs/ExportDialog.tsx`

- [ ] **Task 2.4: Extract Interactive Knowledge Graph into `@scriptor/plugin-graph`**
  - **Description:** Decouple `GraphPanel.tsx`, `GraphCanvas.tsx`, and `graph-layout.worker.ts` into `@scriptor/plugin-graph`.
  - **Acceptance criteria:**
    - [ ] Graph panel and backlinks view registered dynamically via plugin contributions.
    - [ ] Disabling graph plugin terminates graph layout WebWorker and frees memory.
  - **Verification:** `pnpm test:e2e -- e2e/graph.spec.ts`
  - **Dependencies:** Task 1.2
  - **Files likely touched:** `src/components/GraphPanel.tsx`, `src/App.tsx`

- [ ] **Task 2.5: Extract MCP Agent Server into `@scriptor/plugin-mcp`**
  - **Description:** Decouple Model Context Protocol stdio server, patch approval queue, and audit log into `@scriptor/plugin-mcp`.
  - **Acceptance criteria:**
    - [ ] MCP tool handlers and patch queue UI load only when MCP plugin is enabled.
    - [ ] `pnpm check:mcp` verifies read/write permission gating under plugin status.
  - **Verification:** `pnpm check:mcp && pnpm test:e2e -- e2e/mcp-write.spec.ts`
  - **Dependencies:** Task 1.2
  - **Files likely touched:** `packages/mcp/src/index.ts`, `src/components/mcp/McpInspector.tsx`

### Checkpoint: Core Feature Decoupling
- [ ] Workspace builds cleanly with all 5 feature plugins modularized.
- [ ] E2E test suites for canvas, graph, export, and MCP pass independently.

---

### Phase 3: Plugin Management Center UI & Dynamic Marketplace

- [ ] **Task 3.1: Build Plugin Management Center UI (`PluginManagerCenter.tsx`)**
  - **Description:** Build a rich, modern Plugin Management Center modal allowing users to search, inspect, enable, disable, install, and uninstall plugins with toggle switches and resource usage stats.
  - **Acceptance criteria:**
    - [ ] Plugin Center lists core & installed plugins with version, author, description, and status.
    - [ ] Enabling/disabling a plugin dynamically updates sidebar navigation and command palette.
    - [ ] Accessible touch targets ($\ge 44\text{px}$) and OKLCH design system styling.
  - **Verification:** `pnpm check:frontend-quality && pnpm check:portal`
  - **Dependencies:** Tasks 2.1–2.5
  - **Files likely touched:** `src/components/plugins/PluginManagerCenter.tsx`, `src/components/plugins/PluginCard.tsx`, `src/styles/components/plugin-manager.css`

- [ ] **Task 3.2: Rust RPC Plugin Capability Gating**
  - **Description:** Add `check_plugin_enabled` middleware in `crates/ipc` and `src-tauri/src/lib.rs` to return `RpcError::PluginDisabled` when an uninstalled/disabled feature API is invoked.
  - **Acceptance criteria:**
    - [ ] Disabling `@scriptor/plugin-canvas` causes `canvas_hit_test` IPC to return a clean error without crashing desktop shell.
  - **Verification:** `cargo test -p scriptor-ipc`
  - **Dependencies:** Task 3.1
  - **Files likely touched:** `crates/ipc/src/lib.rs`, `apps/desktop/src-tauri/src/lib.rs`

### Checkpoint: Complete Modular System
- [ ] End-to-end plugin management flow verified (enable, disable, uninstall, re-enable).
- [ ] All unit, integration, and E2E suites pass with zero regressions.

---

## Risks and Mitigations

| Risk | Impact | Mitigation Strategy |
|---|---|---|
| **Dangling CodeMirror Extensions on Plugin Disable** | High | Implement cleanup callbacks in `PluginRegistry` to unregister CodeMirror view extensions dynamically. |
| **Orphan IPC Calls to Disabled Rust Modules** | Medium | Implement Rust RPC middleware that returns typed `RpcError::PluginDisabled` responses instead of panicking. |
| **Bundle Size Overhead from Plugin Loader** | Low | Use Vite dynamic `import()` for lazy-loading plugin UI components on demand. |

---

## Open Questions
- Should plugin enablement be stored per-vault (`.scriptor/plugins.json`) or globally per-user (`user-settings.json`)? *(Recommended default: global defaults with optional per-vault overrides).*
