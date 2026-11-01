# MAT 24-workstream midpoint execution register — November 1, 2026

**Historical snapshot (2026-11-01):** superseded MAT closure criteria involving installed/live studies and human sign-off are replaced by [automated MAT acceptance](../MAT-AUTOMATED-ACCEPTANCE.md) effective 2026-11-02. Historical evidence below and the unimplemented behavior it identifies remain unchanged.

This register makes the user's **at least 50% per MAT** target actionable without inventing percentages. It supplements the [executable backlog](../../tasks/plans/2026-10-27-product-maturation-backlog.md) and [acceptance register](../../tasks/plans/2026-10-30-mat-006-024-acceptance-register.md); neither those requirements nor GitHub issue status is replaced.

## How to measure progress responsibly

For every MAT, distinguish four independently reviewable evidence layers:

1. **Scope-complete implementation:** every behavior named in the current MAT issue exists under the existing ownership boundary; no new permission authority.
2. **Negative/restart source proof:** reproducible tests for expected behavior, denial, stale response, crash/cancellation, and vault switching where applicable.
3. **Exact-head integrated CI:** the *same commit* passes native contracts/Rust, source tests, frontend/accessibility, browser, security and relevant visual/desktop gates.
4. **Installed/live and formal acceptance:** representative Windows/macOS/Linux, offline/RTL/keyboard/assistive-technology and actual provider/user data where required, independently reviewed before the capability claim changes.

The **engineering midpoint target** means layers **1 and 2 are satisfied across the full issue scope**, with layer 3 in progress. Two tiny slices or one green PR never imply “50% of the product workstream.” This register deliberately contains no guessed percentage column. A full green CI run on a *partial slice* is useful evidence but does not establish the full workstream's midpoint. Final MAT acceptance still requires all applicable layers and explicit issue-level sign-off.

## All 24 workstreams — verified slices and shortest missing gates

| MAT | Issue | Known source slice or evidence | Next work needed toward full-scope midpoint |
| --- | --- | --- | --- |
| 001 Restore disposition | [#180](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/180) | Restore outcome source merged; issue closed but backlog remains unchecked | Test post-commit lost reply and installed frozen-draft/reopen semantics before checklist acceptance |
| 002 Mutation outcomes | [#181](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/181) | Restore-specific receipt/adapters in [#249](https://github.com/AmirrezaFarnamTaheri/Scriptor/pull/249) | Extend typed uncertain outcomes to the other mutation owners and test repeated/cancelled commits |
| 003 Recovery inventory | [#182](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/182) | [#249](https://github.com/AmirrezaFarnamTaheri/Scriptor/pull/249) + scoped Git conflict source [#251](https://github.com/AmirrezaFarnamTaheri/Scriptor/pull/251), both exact-head CI green | Add authoritative Canvas/external-file sources and multi-vault missing-journal, keyboard/RTL proof |
| 004 Safe recovery actions | [#183](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/183) | Safety work under core integration [#249](https://github.com/AmirrezaFarnamTaheri/Scriptor/pull/249) requires issue-level review | Complete diff/new-note/reviewed-target flow with origin/hash validation and cancel/crash tests |
| 005 Mutation lifecycle | [#184](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/184) | Core lifecycle fixes in [#249](https://github.com/AmirrezaFarnamTaheri/Scriptor/pull/249) | Complete native/renderer fault matrix for editor, Canvas, database, task, backup, rename and provider writes |
| 006 Workspace ownership | [#185](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/185) | No issue-wide reviewed decomposition recorded | Extract responsibility owners while preserving single Markdown writer; test dirty-close, same-note/focus and A→B switches |
| 007 Markdown semantic parity | [#187](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/187) | Existing renderer tests do not prove whole MAT corpus | Land shared semantic fixtures covering markdown/frontmatter/math/citations/tables/raw HTML across source, inspector and export |
| 008 Entrypoint parity | [#188](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/188) | Historical Git identity/daemon/CLI slices (e.g. [#211](https://github.com/AmirrezaFarnamTaheri/Scriptor/pull/211)) | Verify native/CLI/TUI/daemon/MCP shared commit and conflict outcomes, cancellation and lost reply at latest head |
| 009 Database full-vault | [#189](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/189) | Indexed/cursor and browser work [#249](https://github.com/AmirrezaFarnamTaheri/Scriptor/pull/249) | Prove consistent full-vault filtering/aggregate totals at 25k and stale-view fault handling |
| 010 Typed schema/batch | [#190](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/190) | No full typed batch-edit acceptance recorded | Preserve YAML scalar types; add migration/corrupt preset and native stale-hash dry-run per-row receipt tests |
| 011 Evidence provenance | [#191](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/191) | Research capture slices in [#249](https://github.com/AmirrezaFarnamTaheri/Scriptor/pull/249) | Link stable verified source locator to reference/literature/citation with changed/renamed source detection |
| 012 Research journey | [#192](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/192) | Source/browser research workflow work in [#249](https://github.com/AmirrezaFarnamTaheri/Scriptor/pull/249) | Finish capture→review→cite→publish negative/cancellation path and independent task-based proof |
| 013 Bibliography refresh | [#193](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/193) | Local key-diff/create-only review [#252](https://github.com/AmirrezaFarnamTaheri/Scriptor/pull/252), exact-head CI green | Implement watched Better BibTeX/.bib change preview and hash/revision-guarded reviewed replacement |
| 014 Research manifest | [#194](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/194) | Read-only hash review [#256](https://github.com/AmirrezaFarnamTaheri/Scriptor/pull/256), CI pending | Native vault-owned manifest read and clean rebuild/output receipt with explicit tool authorization |
| 015 Connections | [#195](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/195) | Google expired/missing auth recovery [#250](https://github.com/AmirrezaFarnamTaheri/Scriptor/pull/250), exact-head CI green | Unified read-only status across Overleaf/publishing, freshness/pending effects and consented real-account evidence |
| 016 Task identity | [#196](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/196) | Historical task identity slice [#230](https://github.com/AmirrezaFarnamTaheri/Scriptor/pull/230) | Resolve indistinguishable duplicates/reorder/account-switch mappings with no unexpected remote creation |
| 017 Offline-first | [#197](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/197) | Provider expiry work [#250](https://github.com/AmirrezaFarnamTaheri/Scriptor/pull/250) only a partial dependency | Installed network-disabled open/save/search/recovery plus stale queue/replay review tests |
| 018 Command/help availability | [#198](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/198) | Historical command guard work [#216](https://github.com/AmirrezaFarnamTaheri/Scriptor/pull/216) | Shared disabled reason policy across palette, help and launchers; RTL/keyboard/mobile confirmation |
| 019 Permission results | [#199](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/199) | No source-scope completion recorded | Standardize result presentation over separate native/MCP/plugin authorities; test denial/revocation/zero action |
| 020 Responsive systems | [#200](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/200) | Existing visual CI is not the specified full device matrix | Capture/review 320/375/768/1024/1440 at 200% zoom, RTL and keyboard/screen-reader; fix clipped controls |
| 021 Process broker | [#201](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/201) | Prelaunch cancellation and dual-stream flood tests [#253](https://github.com/AmirrezaFarnamTaheri/Scriptor/pull/253), CI pending | Per-adapter timeout/tree/path/diagnostic fault tests and installed interruption/restart proof |
| 022 Capability graduation | [#202](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/202) | Evidence completeness checker [#257](https://github.com/AmirrezaFarnamTaheri/Scriptor/pull/257), CI pending | Validate actual source/release/install links and manual acceptance before human capability review |
| 023 Scale baselines | [#203](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/203) | 32-case scan/search completeness matrix [#255](https://github.com/AmirrezaFarnamTaheri/Scriptor/pull/255), CI pending | Collect real cold/warm 100/1k/5k/25k data, startup/editor/memory/artifact metrics and variance |
| 024 Installed/user acceptance | [#204](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/204) | No consented cross-OS independent MAT study recorded | Execute installed Windows/macOS/Linux, RTL, 200% zoom, offline/expired-provider and user-task protocols |

## Engineering priorities and immediate sequence

**P0:** unfreeze integration by confirming [#249](https://github.com/AmirrezaFarnamTaheri/Scriptor/pull/249) and [#250](https://github.com/AmirrezaFarnamTaheri/Scriptor/pull/250) exact-head acceptance; assess dependent [#251](https://github.com/AmirrezaFarnamTaheri/Scriptor/pull/251) as a stacked, read-only slice. Do not merge solely because CI is green.

**Next source proof:** finish [#252](https://github.com/AmirrezaFarnamTaheri/Scriptor/pull/252), [#253](https://github.com/AmirrezaFarnamTaheri/Scriptor/pull/253), [#255](https://github.com/AmirrezaFarnamTaheri/Scriptor/pull/255), [#256](https://github.com/AmirrezaFarnamTaheri/Scriptor/pull/256), [#257](https://github.com/AmirrezaFarnamTaheri/Scriptor/pull/257) hosted checks and fix any real regressions. Each PR remains a **slice**, not a whole-workstream acceptance.

**High-leverage unstarted scopes:** MAT-006/007/010/011/014/019 receive independent implementation and fault suites; MAT-024 recruits approved real users/devices, while MAT-020/023 collect representative captures and measured performance.

**Never bypass:** vault identity, expected file revision/hash, native scoped grants, OAuth consent, explicit remote-write preview, provenance of source/test measurements, or human installed acceptance. Keep the overall 24-item checklist unchecked until each corresponding issue genuinely meets its definition of done.
