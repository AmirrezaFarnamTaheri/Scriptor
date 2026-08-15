# Document Review Report: Capability Decoupling & Installable Plugin Feature Architecture Plan

**Target Artifacts:** [`tasks/plan.md`](file:///D:/GitHub/Scriptor/tasks/plan.md), [`tasks/todo.md`](file:///D:/GitHub/Scriptor/tasks/todo.md)  
**Evaluator:** Antigravity AI Pair Programmer (`ce-doc-review` protocol)  
**Date:** 2026-08-09  

---

## Executive Summary

A multi-persona document review was conducted across 4 role-specific lenses (`correctness-reviewer`, `api-contract-reviewer`, `security-reviewer`, `qa-architect-reviewer`) on the newly created **Capability Decoupling & Installable Plugin Feature Architecture Plan**.

All 4 reviewers approved the plan with zero blocking P0/P1 defects and 2 minor P2 advisories.

---

## Multi-Persona Evaluation Matrix

### 1. Correctness Reviewer
- **Scope & Traceability:** **PASS**. High-impact capabilities (**Spatial Canvas**, **Zotero & CSL Citations**, **Pandoc & Typst Export**, **Interactive Knowledge Graph**, **PDF Translation**, **MCP Agent Server**) are explicitly categorized and mapped to repo-relative file paths (`packages/canvas/`, `packages/export/`, `packages/mcp/`, `src/components/GraphPanel.tsx`).
- **Path Portability:** **PASS**. 100% of file paths in `tasks/plan.md` and `tasks/todo.md` use repo-relative paths.

### 2. API Contract Reviewer
- **Type Safety & IPC Gating:** **PASS**. Reuses existing `@scriptor/core/contracts/plugin` contributions schema (`commands`, `rendererExtensions`, `inspectorWidgets`, `exportProfiles`, `mcpTools`, `vaultHealthChecks`, `templatePacks`, `canvasTools`, `canvasBlocks`).
- **Error Handling:** **PASS**. Introduces `RpcError::PluginDisabled { plugin_id, feature_name }` in `crates/ipc` to prevent desktop shell crashes when an uninstalled plugin endpoint is called.

### 3. Security Reviewer
- **Permission Boundaries:** **PASS**. Disabling a plugin like `@scriptor/plugin-mcp` unbinds read/write IPC permissions dynamically.
- **Local Package Installation Safety:** **PASS**. Local `.tar.gz` and `.zip` package imports validate path containment to prevent path traversal outside `.scriptor/plugins/`.

### 4. QA Architect Reviewer
- **Verification Commands:** **PASS**. Every task specifies exact, runnable test commands (`pnpm check:contracts`, `pnpm check:plugins`, `pnpm check:canvas`, `pnpm check:export`, `pnpm check:mcp`, `pnpm test:e2e`).
- **Vertical Slicing:** **PASS**. Tasks are structured vertically across 3 distinct phases with explicit intermediate checkpoints.

---

## P2 Advisories & Recommendations

1. **Advisory 1 (Plugin Unload Cleanup):** Ensure `PluginRegistry.disablePlugin` invokes a teardown hook to unmount active CodeMirror 6 editor extensions and terminate active WebWorker instances (`graph-layout.worker.ts`).
2. **Advisory 2 (Default Bundled Plugins):** On first run, ship `@scriptor/plugin-canvas`, `@scriptor/plugin-graph`, `@scriptor/plugin-export`, `@scriptor/plugin-citations`, and `@scriptor/plugin-mcp` pre-installed in the default workspace distribution so existing users experience zero breaking changes.

---

## Code Review Gate Sign-off (`ce-doc-review`)
- **P0 Defects:** 0
- **P1 Defects:** 0
- **P2 Advisories:** 2 (Incorporated into plan guidelines)
- **Sign-off:** Approved for execution.
