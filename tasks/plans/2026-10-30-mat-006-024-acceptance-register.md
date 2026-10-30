# MAT-006–024 — independent acceptance evidence register

Date: 2026-10-30. This register separates **source changes**, **hosted CI**, and **installed/live acceptance**. It does not repeat the implementation specification: each [MAT issue](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues) is authoritative for scope and required regression cases.

**No feature in this register is marked graduated.** Results listed are historical, exact-source evidence; do not reuse a pass for a newer commit. Record every new accepted case with the exact SHA, runner/OS/architecture, test name, result, URL, and the remaining gap. An authored test without an observed failure is not failing-first proof. A rejected/missing native reply is not proof of rollback. The installed process/device and consented external-provider gates cannot be satisfied by browser mocks.

## MAT-006 · [issue #185](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/185)

- **Evidence present:** None; ownership refactor not submitted.
- **Required acceptance assertions:** Same-note navigation, dirty close, inactive-tab restore, A→B switching, focus, source-editor/reader transitions, RTL and zoom.
- **Outstanding evidence:** Packaged cross-vault and keyboard/focus evidence; observed failing-first tests plus exact-head checks.
- **Status:** Open — source-level progress is not a feature graduation.

## MAT-007 · [issue #187](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/187)

- **Evidence present:** No dedicated implementation PR verified.
- **Required acceptance assertions:** Semantic fixture corpus across source, editable preview, inspector, reload and export; unsupported syntax must survive editing adjacent content.
- **Outstanding evidence:** Native/browser adapter round trips and installed visual/accessibility proof.
- **Status:** Open — source-level progress is not a feature graduation.

## MAT-008 · [issue #188](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/188)

- **Evidence present:** #211 merged to main (5930efa); #212 head 10f815c and #213 head 1d2f7fb reconciled; their new CI was pending at this register's creation.
- **Required acceptance assertions:** Wrong-vault commit/status and conflict reads at desktop/daemon/CLI/TUI/MCP; stale hashes, cancellation, post-commit lost replies.
- **Outstanding evidence:** Current #212/#213 exact-head checks; #213 unresolved installed two-client A→B, restart/reconnect thread; full entrypoint parity.
- **Status:** Open — source-level progress is not a feature graduation.

## MAT-009 · [issue #189](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/189)

- **Evidence present:** #232 head 15a1f2f passed CI 41024144641, visual 41024144551, docs 41024144556; ready-for-review reruns subsequently started.
- **Required acceptance assertions:** Stale query/edit scoping plus full-vault 25k-note pagination, stable totals, deterministic sorting, bounded memory.
- **Outstanding evidence:** Installed stale-view/dirty-draft/restart; native indexed query and full-vault aggregate evidence; #232 is a limited safety slice.
- **Status:** Open — source-level progress is not a feature graduation.

## MAT-010 · [issue #190](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/190)

- **Evidence present:** No dedicated implementation PR verified.
- **Required acceptance assertions:** YAML number/string/null/date preservation; corrupt presets; migration; stale-hash rejected batch edits; partial failure receipts.
- **Outstanding evidence:** Dry-run/confirmation UI, native row-specific results and packaged rollback/uncertain-outcome evidence.
- **Status:** Open — source-level progress is not a feature graduation.

## MAT-011 · [issue #191](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/191)

- **Evidence present:** No dedicated implementation PR verified.
- **Required acceptance assertions:** Capture passage→locator→reference key→literature note→manuscript citation, source rename, content alteration and offline.
- **Outstanding evidence:** Source-preserving renderer/indexer integration and installed capture provenance acceptance.
- **Status:** Open — source-level progress is not a feature graduation.

## MAT-012 · [issue #192](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/192)

- **Evidence present:** No dedicated implementation PR verified.
- **Required acceptance assertions:** One complete capture→review→bibliography→literature note→citation→publish journey, missing tool, cancellation, dirty editor.
- **Outstanding evidence:** Real task-based UI/RTL/keyboard and publishing artifact evidence; separate provider permissions.
- **Status:** Open — source-level progress is not a feature graduation.

## MAT-013 · [issue #193](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/193)

- **Evidence present:** No dedicated implementation PR verified.
- **Required acceptance assertions:** Truncated/malformed .bib, duplicated citation keys, external edit between preview/apply, watcher burst and offline Zotero.
- **Outstanding evidence:** Reviewed diff/consent and byte-preserving bibliography check on native files.
- **Status:** Open — source-level progress is not a feature graduation.

## MAT-014 · [issue #194](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/194)

- **Evidence present:** No dedicated implementation PR verified.
- **Required acceptance assertions:** Manifest inputs and hashes, clean rebuild, changed bibliography, missing compiler, unapproved execution and cancellations.
- **Outstanding evidence:** Reproducible artifact/receipt and native process-authority proof, no invented deterministic-output claim.
- **Status:** Open — source-level progress is not a feature graduation.

## MAT-015 · [issue #195](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/195)

- **Evidence present:** No dedicated implementation PR verified.
- **Required acceptance assertions:** Connected credentials vs completed transfer, token expiry, scope revocation, stale response, account/vault switches.
- **Outstanding evidence:** Installed account recovery and consented live-provider verification, read-only status not write authority.
- **Status:** Open — source-level progress is not a feature graduation.

## MAT-016 · [issue #196](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/196)

- **Evidence present:** #230 head a78322b had hosted CI 40905927612 pass; not integrated or accepted.
- **Required acceptance assertions:** Duplicate indistinguishable task titles, reorder, note move, account change and ambiguous remote identity.
- **Outstanding evidence:** Native/renderer mapping tests plus live provider reconciliation and unexpected-write prevention.
- **Status:** Open — source-level progress is not a feature graduation.

## MAT-017 · [issue #197](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/197)

- **Evidence present:** No dedicated implementation PR verified.
- **Required acceptance assertions:** Offline open/save/search/recovery, sleep-resume, revoked token, queued upload and local revision conflicts.
- **Outstanding evidence:** Network-disabled installed-client evidence and reviewed replay/consent outcomes.
- **Status:** Open — source-level progress is not a feature graduation.

## MAT-018 · [issue #198](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/198)

- **Evidence present:** #216 head 38c43ef had hosted CI 40974725315 pass; not integrated or accepted.
- **Required acceptance assertions:** Command palette/help/launcher availability parity with missing vault, disabled plugin, RTL and keyboard focus.
- **Outstanding evidence:** Exact integrated head plus installed screen-reader and F1/help workflow checks.
- **Status:** Open — source-level progress is not a feature graduation.

## MAT-019 · [issue #199](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/199)

- **Evidence present:** No dedicated implementation PR verified.
- **Required acceptance assertions:** Plugin/MCP/native consent scope separation, revocation mid-flight, denial, cancellation, disabled plugin, zero actions.
- **Outstanding evidence:** Keyboard/screen-reader permission UI evidence; native authority remains independent.
- **Status:** Open — source-level progress is not a feature graduation.

## MAT-020 · [issue #200](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/200)

- **Evidence present:** No dedicated MAT-020 acceptance artifact verified; existing design geometry alone is not a graduation.
- **Required acceptance assertions:** 320/375/768/1024/1440px, 200% zoom, Persian RTL, German labels, focus and modal scroll ownership.
- **Outstanding evidence:** Reviewed real captures at each target; no blind golden refresh or clipped controls.
- **Status:** Open — source-level progress is not a feature graduation.

## MAT-021 · [issue #201](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/201)

- **Evidence present:** No dedicated implementation PR verified.
- **Required acceptance assertions:** Timeout before/after spawn, hung process-tree termination, stdout/stderr floods, path escapes and interrupted restart.
- **Outstanding evidence:** Native fault injection for each supported process adapter plus bounded/redacted diagnostics.
- **Status:** Open — source-level progress is not a feature graduation.

## MAT-022 · [issue #202](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/202)

- **Evidence present:** No graduation submitted.
- **Required acceptance assertions:** Writing/recovery, Database Studio and capture/publish each need owner, stable contract, negative/restart tests, privacy, performance and packaged evidence.
- **Outstanding evidence:** Do not relabel experimental until all mandatory gates have links and observed results.
- **Status:** Open — source-level progress is not a feature graduation.

## MAT-023 · [issue #203](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/203)

- **Evidence present:** No new measured 100/1k/5k/25k report verified.
- **Required acceptance assertions:** Two independent warm/cold runs, cache-cleared start, indexing, search, editor latency, RAM, distribution size and variance.
- **Outstanding evidence:** Pinned environment, repeatable scripts, real measurements and regression thresholds.
- **Status:** Open — source-level progress is not a feature graduation.

## MAT-024 · [issue #204](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/204)

- **Evidence present:** No installed Windows/macOS/Linux or real-user acceptance record verified for MAT program.
- **Required acceptance assertions:** Install/upgrade/restore crash and reopen, source publication, 320px/200% zoom, RTL, screen reader, expired provider, offline.
- **Outstanding evidence:** Consented independent platform and user task outcome logs; mocked E2E does not suffice.
- **Status:** Open — source-level progress is not a feature graduation.

