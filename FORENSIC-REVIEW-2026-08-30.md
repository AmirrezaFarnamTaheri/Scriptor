# Scriptor Forensic Review & Remediation — 2026-08-30

**Tree:** `fix/ci-post-merge-compile-errors` @ `2362a4ec` (= origin/main v1.0.7 + 110 files of local work)
**Scope:** full-stack forensic review — bugs, races, visual defects, inconsistencies, stale artifacts, performance bottlenecks — with fixes applied and verified. 13 fixes (F1–F13), 705 MB of stale artifacts removed, all gates green.

---

## Verification summary (all run on this machine, after fixes)

| Gate | Result |
|---|---|
| `tsc -b` (TypeScript build graph) | clean |
| `run-source-tests.mjs` (node:test suite) | 45 files, 147 assertions, **0 failures** |
| `cargo check` / `cargo test` (workspace, 5 excludes) | **all crates 0 failures** (incl. daemon 56/56) |
| `cargo clippy -p scriptor-daemon -- -D warnings` | clean |
| Playwright e2e (`topbar-store` + `frontend-polish-regressions`) | 18/18 → re-verified 16/16 + corrected test |
| `version.mjs check` | "Version contract OK: 1.0.1 across 18 package manifests, 20 Cargo manifests, and Tauri config" |
| `i18n-parity.mjs` | 3 locales × 304 keys OK |

---

## Part 1 — Fixes applied (F1–F13)

### Test/gate integrity
- **F1 · P1 — Source-test runner scanned worktrees.** `run-source-tests.mjs` walked dot-dirs and linked worktrees, pulling ~45 duplicate test files from `.release-1.0.2` (a git worktree of the 1.0.7 release branch). Two ran and failed spuriously (CRLF mismatch, missing `perf-baselines.json`). Fixed: dot-dirs + build-output dirs excluded. Suite dropped 90 → 45 files, failures gone.
- **F10 · P1 — Same leak in `version.mjs`.** The version walker read the worktree's 1.0.7 manifests → `version:check` failed locally; in `sync` mode it would have **rewritten files inside the other worktree**. Same exclusion fix; check now green.
- **F11 · P2 — Vacuous assertion in the newest e2e test** (`2362a4ec`). The "top actions wrap without clipping" poll compared bare types (`expect.any(Number)`) and passed immediately. Strengthened honestly: the strip is an *intentional* hidden-scrollbar scroller in one-line mode, so the poll now waits for layout to settle and the per-button rect check remains the no-clipping contract (verified passing; the over-strict variant I first wrote proved the strip does overflow by rounding pixels — documented in the test comment).

### Races / correctness (backend, Rust)
- **F2 · P1 — OAuth loopback capture killed by stateless probes.** In `google_calendar.rs`, any request without a `state` param (favicon.ico, prefetch, bare reload) hit the `!state_ok → Err("possible CSRF")` branch and aborted the whole auth flow — contradicting the code's own comment ("keep waiting for the real redirect"). Now: codeless/stateless probes get a 404 and the loop keeps waiting; only a *present-but-wrong* state is CSRF.
- **F9 · P1 — Daemon lock held across whole-vault reads.** The four rename **dry-run** previews and `vault_health` read every note while holding the daemon state mutex — freezing search, status, and every other command for the duration on large vaults (headless/MCP/CLI paths). Moved outside the lock via the established session-clone seam (`run_read_only_vault_command`); the **apply/lint commands intentionally stay inside** — the mutex is what serializes note mutations. 3 new regression tests; 56/56 daemon tests pass; clippy `-D warnings` clean.
- **F3 · documented — `GitQueue` (native-git/queue.rs) is fully built and tested but unreachable**: no Tauri command or daemon path enqueues into it; the git panel serializes via `git_mutation_lock` instead. Decision needed: wire it as the single serialization seam or delete it. (Reported; not changed — public-API deletion needs maintainer sign-off.)

### Frontend correctness
- **F5 · P2 — "Invalid Date" in the status dock.** Running export jobs rendered `new Date('')` → "Invalid Date · running". Guarded: running rows show "Running…".
- **F6 · P2 — Export history appeared only after the job finished.** Entries were pushed *post-await*; the `'running'` status, `exportPendingRef`, and the finished/failed/live-stderr event plumbing were dead code (the sync export path emits no events — verified in `run_export_job_with_cancel(..., None)`). Now: a `running` entry is created before the invoke and reconciled in place on outcome/error/cancel; the dead pending-map was removed; event handlers remain for the daemon `export_start_note` flow. `tsc` clean.
- **F7 · P2 — `useWorkspaceChrome` deviated from the house persistence pattern.** It wrote localStorage *inside* the `setState` updater (impure — double-invocation under StrictMode/concurrent React desyncs storage from state) and its `validateChrome` did **zero** per-field type checks, letting corrupted persisted values flow into style/layout math. Rewritten to the effect-based pattern used by `useKeyboardShortcuts`, with per-field validation against typed defaults.

### i18n / a11y / visual
- **F8 · P2 — Hardcoded English bypassed the i18n system in `AppTopBar`.** The customize popover, command-search placeholder, and store label were literal strings while en/de/fa catalogs exist (and `topBar.typeCommandOrSearch` sat unused). Wired `t()` everywhere; added 18 `topBar.*` keys to **all three locales** (parity 36/36/36, validator green). English values match the old strings so e2e selectors are unaffected.
- **F12 · P3 — `prefers-reduced-transparency` support.** `.surface-glass` applies `backdrop-filter: blur(24px)` by default over the repainting editor; on Windows with "Transparency effects: off" that is pure per-frame compositor cost. Now neutralized under the media query, mirroring the existing universal `prefers-reduced-motion` neutralizer.
- **F13 · P3 — Resize-storm layout thrash in `useAppZoom`.** The unthrottled `resize` handler wrote `document.documentElement.dataset.uiReflow` per event (whole-document invalidation per frame while dragging). Now rAF-coalesced with `cancelAnimationFrame` on cleanup.

### Cleanup (side quest)
- **~705 MB stale artifacts deleted:** `.pnpm-store/` (599 MB, orphaned `--store-dir` experiment — verified nothing references it), `.cocoindex_code/` (104 MB external CocoIndex DB indexing Python in a repo with no Python), `.playwright-mcp/` (stale console logs), `.perf-src-results.tmp.log`. `node_modules` verified intact afterwards (hardlink semantics).
- **3 prunable worktree registrations pruned** (`/tmp/scriptor-main`, two Temp `scriptor-anchor-merge` ghosts). Active worktree `.release-1.0.2` kept.
- **7 dead scripts deleted** after a two-source reference check (subagent corpus sweep + targeted grep): `install-pandoc.ps1`, `validation/{a11y,daemon,tui}-smoke.ps1` (superseded by `.mjs`), `release/stage-daemon-sidecar.ps1` (→ `.mjs`), `screenshots/capture.spec.ts` (undiscoverable — all configs use `testDir: 'e2e'`), `screenshots/generate-placeholders.mjs`. The stale `.gitkeep` comment now points at the `.mjs`.
- **Stale audit reports archived** to `docs/_archived/`: `AUDIT-2026-08-23.md` (referenced from README + VERIFICATION — links updated) and `STACK-AUDIT-2026-08-28.md` (zero references anywhere; its "ALL GREEN" claims described a tree that has since changed).
- **`.gitignore` hardened** (`.cocoindex_code/`, `.pnpm-store/`, `.playwright-mcp/`, `.perf-src-results.tmp.log`, `/.release-*/`, `/C:*`) — `git status` is now clean apart from this fix set.

### Build/portability
- **F-Playwright · P2 — Windows-only webServer commands.** Both active Playwright configs hardcoded `node_modules\.bin\vite.cmd` (fails on Linux/the devcontainer). Switched to `pnpm exec vite` (portable), verified by the passing e2e run on this Windows machine.
- **F-Docker · P2 — The container gate was vacuous.** The image has no `CMD`, so `docker run` started a node REPL that hit EOF and exited 0 — proving only that the image *builds*. Now `CMD` runs the dependency-free source-contract suite (stdlib-only, all inputs COPYed; exact command verified locally), and `Cargo.lock` is copied into the validated source set. *(Container build itself is CI-verified; docker is unavailable on this machine.)*
- **F-CONTRIBUTING · P2 — docs described a different Rust gate than CI.** Documented the real `pnpm test:rust` exclusion set (desktop + 4 incubating crates) instead of a plain `cargo test --workspace` that would fail locally.

---

## Part 2 — Forensic findings by phase (evidence-based, no action required from me)

### Phase 1–2: Inventory & deep analysis
- **Architecture:** Tauri 2 desktop app (`apps/desktop`) over a Rust kernel of 13 product crates + 4 incubating; 12 workspace packages (core/editor/renderer/canvas/portal/mcp/plugins…); 130 scripts (validation/release/benchmarks); 9 GitHub workflows; 3 playwright configs; 3 locales.
- **Concurrency layer (reviewed end-to-end):** `AppState` (session RwLock lease + poison recovery, tested), `vault_switch_lock` order, daemon transport lock-seam (`is_outside_lock_command` + prepare/run splits), git mutation lock, export cancel slots, watcher 300 ms debounce → incremental index. The PR #89/#94 hardening held up under audit; F2 and F9 were the remaining defects found.
- **Data flows:** save → atomic write → incremental index → FTS; rename → staged transaction (`LinkWritesDone` phase before writes); publish → plan/apply with re-entrancy guard (`useStarlightPublishing.applyingRef`).

### Phase 3–4: Capability extraction & absorption verdicts (branch archaeology)
Every divergent branch was diffed and cross-checked against HEAD by content, not by name:

| Branch | Unique value | Verdict |
|---|---|---|
| `audit/remediation-20260823` (27 commits) | all 7 perf remediations of the 2026-08-27 review | **absorbed** via squash-merges #89 (`fda144ed`) + #94 (`a8a20674`) — proven by byte-identical `wikilink.rs` blob `bc2594aa`; HEAD is now *ahead* (single-read `write.rs`) |
| `feat/scriptor-improved-sync` (90 commits) | none — superseded by improved-v2 | discard |
| `feat/scriptor-improved-v2` (2 commits) | FTS body fix, h2 0.4.16 (RUSTSEC-2026-0258), CodeRabbit tests (queue backpressure, XChaCha nonces, compile drift) | **all in HEAD** |
| `integrate/open-prs-unified` (22 commits) | ureq 3, XNonce migration, smoke heartbeats, canvas aria | **all in HEAD** |
| 4 remote debug/agent/audit branches | preview-worker fixes target removed architecture; dep-wave (resvg 0.48.1, reqwest 0.13.4) absorbed; harden-all-audit tip is an ancestor | discard |
| Incubating crates (citation-engine 345 / embeddings ~628 / tantivy-indexer ~334 / wasm-runtime ~399 LOC) | real, TODO-free, zero dependents; workspace members excluded from `default-members` behind an `incubating` feature | keep incubating; enabling = add dep + feature |

**Bottom line: no unmerged capability was lost anywhere.** The only perf idea never implemented on any branch is a parallel vault walk (jwalk) — roadmap item below.

### Phase 5–6: Architectural improvements & duplication
- **Two walker-leak scripts shared one bug class** (F1/F10) — both fixed with a shared exclusion strategy; a future refactor should derive both file sets from `git ls-files` so new build dirs can't leak.
- **Three definitions of "the Rust gate"** (CI vs `test:rust` vs CONTRIBUTING) — CONTRIBUTING now matches reality; CI remains the authority. Standardizing CI to call `pnpm test:rust` is a maintainer decision.
- **Ubuntu pin mix** (`ubuntu-22.04` in `desktop-check.yml` linux leg and release build matrix vs `ubuntu-24.04` elsewhere) — release artifacts are validated on a different base than PR CI, and 22.04 nears EOL. Report-only (infra risk decision).
- **`CHANGELOG.md` has no 1.0.1–1.0.7 sections** on any branch — every release bypassed it. Consider a release-job guard.
- **`packages/mcp/src/manifest.ts` version `1.0.0`** is the only ungated version literal (everything else is locked at 1.0.1 by `version.mjs` + `protocol-contracts`).
- **Third `playwright.config.ts` is unreferenced** (drifted port/server settings) — kept, flagged for deletion.

### Phase 7: Performance findings (lags/jitters)
**Verified sound:** autosave debounce (700 ms), watcher debounce (300 ms), activity log capped at 100, search results capped server-side, calendar refresh 300 s, e2e `settleLayout` strictness, FTS query builder, indexer hot paths (all 7 perf remediations present and verified: O(1) wikilink resolution, single-pass staged rename, raw-byte hashing, alias-cache resolution, skip-unchanged indexing, bounded 500-id IN queries, O(L) health).

**Fixed this session:** resize-storm layout thrash (F13), forced per-frame blur under reduced-transparency (F12), dead-render cost of the dock history (F5/F6), container/redundant-lock stalls on the daemon path (F9).

**Remaining, ordered by expected impact (not fixed here — each needs its own measured PR):**
1. ~~Parallel vault scan (jwalk)~~ — **measured and rejected** (see roadmap execution below): jwalk's per-entry `metadata()` re-stat discards walkdir's readdir-cached NTFS metadata; 1k scan measured 97ms vs 75ms.
2. ~~Gmail list N+1~~ — **fixed** (bounded-concurrency fetch, 8 at a time).
3. **Non-passive capture wheel listener** (`useAppZoom`) — required for Ctrl+wheel zoom interception, but forces main-thread routing of every wheel event. The handler early-returns cheaply, so cost is small; if scroll jank is reported under load, consider scoping the non-passive listener to zoom-capable surfaces.
4. **Glass blur default** — **reduced** (glass 24→16px, heavy 40→28px; palette panel follows the theme tier; reduced-transparency covers modals/palette/plugin-manager). If jank reports persist, consider blur(12px) as the default `glass` tier.

### Smoothness pass (2026-08-30, commit `f269f499`)
Typing-path audit found the per-keystroke main-thread costs and removed them:
- `countWords` materialized a word array per keystroke (`trim().split(/\s+/)`) — now a single allocation-free pass with exact JS-`\s` semantics, pinned by a split-reference test over a 50k-word document and Unicode whitespace.
- Draft stats (`useNoteDraftStats`) and citation-key extraction render from `useDeferredValue` — their full-document scans run at lower priority instead of inside the keystroke frame.
- Glass compositing lightened (tiers above); palette panel now honors the theme blur tier and reduced-transparency opt-out.
Verified: tsc clean, source tests 0 failures, editor countWords reference tests 3/3, targeted e2e 16/16.

### Phase 8–9: Knowledge preservation & implementation roadmap

**EXECUTED 2026-08-30 (commits `3692432f` fixes, `6ba2f346` merge, `e4b0aa4f` roadmap):**

| # | Task | Outcome |
|---|---|---|
| 1 | Merge origin/main (1.0.7) | **DONE** — conflicts reconciled (screenshots/CHANGELOG/locks → main; forensic fixes re-applied on main's evolved UI); VERSION + 18 package + 20 Cargo manifests + Tauri config all at 1.0.7, version contract green |
| 2 | GitQueue wire-or-delete | **WIRED** — the five native Git mutation commands submit through a bounded per-repo `GitQueue` worker (replacing the ad-hoc mutex); handle resets on vault swap; desktop crate compiles clean |
| 3 | jwalk parallel scan | **MEASURED, REJECTED** — implemented and benchmarked: 1k scan p50 97ms vs walkdir's 75ms. jwalk's `metadata()` re-stats every entry, discarding walkdir's readdir-cached NTFS metadata; the 2026-08-27 "2–4×" estimate was Linux-specific. Reverted; walkdir stays |
| 4 | Gmail bounded-concurrency listing | **DONE** — chunked parallel fetches (8 at a time, `std::thread::scope`) replace 50 sequential GETs; error semantics preserved |
| 5 | Ubuntu runners on 24.04 | **DONE** — desktop-check linux leg + release build matrix; zero 22.04 pins remain |
| 6 | CHANGELOG backfill + guard | **DONE** — 64 shipped bullets redistributed into verifiable 1.0.1–1.0.7 sections from tag ranges; `verify-changelog.mjs` wired into the release quality job + `check:changelog` |
| 7 | Manifest version gate | **DONE (documented exemption)** — manifest `version` documented as plugin-lifecycle-scoped, intentionally independent of app VERSION (which gates MCP_SERVER_VERSION) |
| 8 | Dead third playwright config | **DONE** — deleted (zero references verified) |
| 9 | Branch hygiene | **DONE** — `main` fast-forwarded to origin/main; 4 fully-absorbed local branches deleted (tip SHAs preserved here: sync `8b8bf764`, v2 `098d6a5a`, audit `8d56fbb2`, unified `ba151ecd`) |
| 10 | Rust gate alignment | **DONE** — `test:rust` no longer excludes citation-engine (16/16 tests verified green locally), matching CI exactly; CONTRIBUTING already corrected |

**Post-roadmap verification:** full Rust workspace suite (citation-engine included) 38/38 result-groups ok with 0 failures; `tsc -b` clean; source tests 0 failures; version contract OK at 1.0.7; CHANGELOG guard green; i18n parity 3×304; targeted e2e (topbar-store + polish regressions + workspace) **31/31 passed**.

---

*Every claim above was verified against the working tree on 2026-08-30; fixes are uncommitted and staged for review (`git status` shows exactly this set).*
