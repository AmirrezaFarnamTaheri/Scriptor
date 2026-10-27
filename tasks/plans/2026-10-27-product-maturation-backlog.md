# Scriptor Product Maturation — Executable Backlog

> Source: substantive merged PRs #175, #172, #162, #160, #151, #150, #149, #148, #147, #146, #143, #135, #134, #133 and #128; analysis from October 27, 2026.
>
> Scope excludes release-only, CI-only and dependency-only work. This branch is the initial functional slice, **not** completion of this backlog.

## Working rules
- Preserve Markdown and local bibliography files as source of truth; do not create parallel mutable editors, workspace managers, or permission brokers.
- Native validation, vault ownership, expected hashes, and authorization remain authoritative.
- A failed transport call does not establish that a native operation rolled back.
- Every deliverable: focused failing regression, minimum implementation, clean exact-head CI, platform proof where required, reviewed screenshots where UI changes, and updated capability ledger only after actual graduation.
- Do not infer that provider mocks prove live Google/Overleaf/Zotero support. Preserve current experimental labels.
- Work against the current main plus verified dependencies. PR #179 is merged; this branch includes its audited dependency fixes through an explicit merge commit.
- Mark only individually verified tasks completed. Product behavior, integration and deployment evidence are distinct.

## P0 — data integrity, transaction outcomes and recovery
- [ ] **MAT-001 — Restore disposition and unconfirmed native-response safety, initial slice**. Files: `src/lib/restoreOutcome.ts`, `src/hooks/useVaultBackup.ts`, focused `src/lib/restoreOutcome.test.ts`. Define rolled-back/committed-ready/committed-needs-reopen/recovery-required semantics. A committed or recovery-required restore never resumes the old draft; only committed-ready reloads the workspace. Authorization failures before native submission can safely abort; failures after submission remain indeterminate and leave the original draft frozen until vault reopen. Verify classifier and bridge tests, plus exact-head hosted CI, before treating the integrated task as complete. **Status: implemented; CI/visual passed on `2a7e64a`, current-head CI after CodeRabbit fix and real packaged recovery acceptance pending.**
- [ ] **MAT-002 — Cross-feature operation outcome contract**. Owners: native bridge and `src/lib/workspace/`. Deliver a typed operation receipt (vault ID, operation ID, affected paths, expected/actual revision when known, committed effects, retry safety, required recovery) without replacing feature-specific native results. Explicitly represent uncertain transport outcomes. Tests: fail-before-write, fail-after-commit, cancellation during commit, wrong vault, restart, repeated operation. Depends on MAT-001.
- [ ] **MAT-003 — Recovery Center read-only inventory**. Owners: backup, note history, Canvas, external conflict surfaces. Reuse existing recovery artifacts and link to owning screens; never infer rollback from absent UI state; avoid duplicate restore authority. Tests: interrupted restore, missing journal, error disclosure, keyboard, RTL and narrow viewports. Depends on MAT-002.
- [ ] **MAT-004 — Safe recovery actions**. Preview diffs, restore into a new note or reviewed destination, verify originating vault and revisions, show irreversible consequences. No automatic overwrite; user approval remains native. Test cancel/retry/crash/reopen. Depends on MAT-003.
- [ ] **MAT-005 — Mutation lifecycle audit**. Audit editor, Canvas, database, tasks/Kanban, backup, import, rename and provider writes for generation, revision, cancellation and active-draft coordination. Add reproducible fault-injection tests with wrong-vault and late-response assertions. Depends on MAT-002.

## P0 — workspace and authoring consistency
- [ ] **MAT-006 — Workspace ownership decomposition**. Owners: `src/App.tsx`, `useWorkspaceEditor.ts`, `useWorkspaceComposition.ts`. Extract controllers by responsibility without changing the single mutable Markdown editor policy. Tests: same-note navigation from feature leaves, dirty-close, inactive tab restoration, cross-vault switch, focus restoration. Depends on MAT-005.
- [ ] **MAT-007 — Markdown semantic parity corpus**. Shared fixtures for frontmatter, wikilinks, extended tasks, citations, tables, math, diagrams, raw HTML and malformed blocks. Verify source→preview→source, inspector and export, with explicit unsupported-syntax preservation; compare semantics rather than identical DOM. Depends on MAT-006 where lifecycle changes.
- [ ] **MAT-008 — Cross-entrypoint contracts**. Desktop/CLI/TUI/daemon/MCP adapters must delegate same supported mutation semantics to shared native authority. Tests: authorization, session identity, cancellation, expected-content-hash, error mapping and committed outcomes. Depends on MAT-002.

## P1 — research workspaces and publication
- [ ] **MAT-009 — Full-vault Database Studio queries**. Owners: native indexer, `src/lib/databaseStudio.ts`, `DatabaseStudioPanel.tsx`. Preserve existing 200-candidate/32MiB bounds until server-side filtering, pagination and consistent totals are verified; never present a partial aggregate as full-vault. Test 25k-note fixture and deterministic pagination. Depends on MAT-005.
- [ ] **MAT-010 — Typed schema, view migration and reviewed batch edits**. Preserve original YAML scalar types, detect stale revision, support dry-run preview and per-note results, continue safely on partial failure. No auto-merge. Depends on MAT-009.
- [ ] **MAT-011 — Evidence provenance records**. Relate captured source, verified passage locator, reference key, literature note and manuscript citation with stable vault-owned references; flag missing or changed sources. Tests: rename, duplicates, stale excerpts, untrusted captures. Depends on MAT-005.
- [ ] **MAT-012 — Guided research journey**. Compose capture→review→bibliography→literature note→citation→validation→export through existing modules. Explicit checkpoints and clear recovery, no second storage authority. Test one full fixture-driven journey and manual task success. Depends on MAT-011.
- [ ] **MAT-013 — Bibliography refresh**. Watch selected Better BibTeX / .bib output; offer reviewed diffs, duplicate/citekey reconciliation and content-hash guard. Never silently overwrite bibliography. Tests: exporter truncation, invalid BibTeX, rename, citation stability.
- [ ] **MAT-014 — Reproducible research project manifests**. Versioned project definition listing inputs, bibliography, execution permissions, export profiles and artifact hashes; stable output receipts and honest rebuild status. Test a clean project rebuild and changed-input detection. Depends on MAT-007, MAT-011.

## P1 — connections, tasks and offline behavior
- [ ] **MAT-015 — Read-only Connections status**. Reuse Google/Overleaf/publishing provider authority; show connected account, authorization vs sync freshness, pending review, last error and recovery route; never merge write scopes. Live-packaged acceptance required for support claims.
- [ ] **MAT-016 — Task identity edge-case hardening**. Current task indexer already has semantic stable IDs, paging and remote reconciliation. Target remaining indistinguishable-title reorder and provider mapping ambiguity. Tests: duplicates, reorder, note rename, account change and offline edit; no unexpected remote task creation. Depends on MAT-005.
- [ ] **MAT-017 — Offline-first acceptance**. With network down or credentials revoked, editing, local search and recovery remain usable. Queued provider effects must not silently commit against stale local revisions; use review and receipts. Test sleep/resume and account expiration. Depends on MAT-015.

## P2 — usability, governance and capability graduation
- [ ] **MAT-018 — Command, Help and capability state alignment**. One availability/prerequisite policy consumed by command palette, tool launchers and contextual offline help. No duplicate permission owner. Test keyboard, disabled reasons, localization and recovery actions.
- [ ] **MAT-019 — Consistent permission and action-result UI**. Plugin/MCP/native approval keep separate scopes, but share contextual action consequences and review affordances; no inert controls. Test keyboard/screen-reader semantics, pending, denial, success and revocation.
- [ ] **MAT-020 — Responsive design-system consolidation**. Shared contracts for panels, scrolling, empty states, dialogs and feedback. Review actual light/dark/RTL images at 320/375/768/1024/1440 widths and 200% zoom; never blindly update goldens.
- [ ] **MAT-021 — Existing process broker completeness**. Audit LaTeX/Pandoc/Python/Typst/diagram/publishing process cancellation, timeout, sandbox path, bounded logs and process-tree termination. Consolidate policy without granting new execution authority.
- [ ] **MAT-022 — Evidence-based capability graduation**. Extend `docs/CAPABILITY-MATURITY.md` with ownership, positive/negative/restart/recovery tests, performance, real-provider or packaged evidence, docs and reproducible manual journey results. Start with writing/recovery, Database Studio and capture-to-publication. Do not mark experimental features supported without satisfying all gates.

- [ ] **MAT-023 — Measured performance and scale baselines**. Benchmark 100/1k/5k/25k-note vaults for opening, first-note latency, search, indexing, editor responsiveness, memory and app size with reproducible hardware/toolchain details. Keep FTS5 where it meets budgets; prohibit invented gains. Tests: repeatable fixture generation and automated regression thresholds plus manual variance review.
- [ ] **MAT-024 — Real-user and installed-app acceptance**. Design writing/recovery, Database Studio and source-to-publication studies with scripted tasks and success/error/cancellation criteria. Verify installed Windows/macOS/Linux, Persian RTL, 200% zoom, keyboard and screen reader use. Real Google/Overleaf credentials and privacy approval remain external gates. Record observed evidence separately from browser mocks.

## Sequencing and practical PR boundaries
1. **Current PR:** MAT-001 with this backlog, confirmed native-status mapper and unconfirmed-invoke guard. CI and visual review passed on `2a7e64a`; the CodeRabbit follow-up needs new exact-head checks. MAT-001 remains unchecked until installed-client lost-reply, frozen-draft exit, restart, and restore-journal reconciliation acceptance is recorded.
2. **Next focused PRs:** MAT-002 then MAT-003/004/005. Each has its own regression suite and outcome proof.
3. **Parallel after shared contracts:** MAT-006/007/008 and MAT-009/010/011/012/013/014.
4. **Independent user-facing work:** MAT-015/016/017, MAT-018/019/020/021.
5. **Final graduation:** MAT-022 after packaged and user-journey evidence. Maintain the checklist incrementally; review each task against current source before implementation.

## Definition of done for each task
- Tests fail on the previous behavior and pass on the changed behavior.
- No weakening of the existing audit, authorization, lint, UI, or release gates.
- Native and browser checks pass on the exact head; selected tasks also require real packaged/provider/assistive-technology evidence.
- Failure, cancellation, stale state, and recovery paths are documented and actionable.
- One independently reviewable PR, with a clear scope, migration/recovery behavior, tests, and capability claim.
