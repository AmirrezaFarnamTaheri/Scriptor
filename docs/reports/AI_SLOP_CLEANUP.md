# Frontend UI cleanup review report

**Date:** 2026-08-05  
**Scope:** Pull request #29  
**Status:** independently re-audited, corrected, verified, and merged

## Purpose

This report records concrete defects removed from the frontend-polish change set. It is not a certificate that the repository contains no remaining debt.

## Corrected defects

- **Git lifecycle ownership:** status data, status loading, status errors, and Git mutation activity are separate states owned by `useWorkspaceGit`; background status refreshes no longer clear unrelated workspace errors or masquerade as “not a Git repository.”
- **Git retry correctness:** retry enters a non-overlapping loading state and disables repeated submission while the status request is active.
- **Explicit empty Git selection:** untouched selection and an intentional “select no files” choice are represented separately, so unchecking the default file does not silently reselect it.
- **Stale Git commit selections:** paths removed by a status refresh are filtered before commit selection is derived.
- **Invalid interactive markup:** Git row buttons remain outside the checkbox label and are associated with the checkbox through `htmlFor`.
- **Truthful keyboard shortcuts:** Git, sidebar, and inspector hints now derive from registered `Mod+Alt+…` commands, and rendered tests execute the advertised shortcuts rather than checking labels alone.
- **Translation completeness:** Git loading, error, retry, clean-state, and row-action copy is localized in English, German, and Persian; validation now rejects unresolved static `t('…')` references.
- **Memoization defeated by inline callbacks:** row handlers originate at the parent and remain stable across selection-only changes.
- **Tooltip accessibility ambiguity:** visual tooltip content is hidden from assistive technology while triggers expose complete accessible names.
- **Fixed overlay containment risk:** the shared panel shell no longer uses a transform that changes the containing block of fixed descendants.
- **MCP empty-state regressions:** decorative icon semantics and localized copy are corrected, while drafts and audit remain accessible when no tools are registered.
- **Unowned async states:** plugin and MCP loading/error APIs that callers could not truthfully supply were removed.
- **Documentation drift:** React, TypeScript, Vite, CSS, Tauri, daemon, MCP, token, and font guidance points to executable sources of truth; `DESIGN.md` maps semantic roles to runtime variables rather than copying resolved theme values.
- **Unsupported completion claims:** duplicate task ledgers and claims of universal sub-16 ms rendering, complete visual validation, or zero remaining debt were removed.

## Focused regression evidence

- `scripts/validation/frontend-polish-contracts.test.mjs`
- `scripts/validation/source-contracts.mjs`
- `e2e/frontend-polish-regressions.spec.ts`

The focused contracts now cover Git lifecycle selection, explicit empty selection, stale selection removal, row semantics, translation-reference resolution, MCP tab availability and localization, shortcut registration, shortcut execution, status failure/retry behavior, and visual-tooltip accessibility.

## Independent audit follow-up

The independent-audit implementation was applied in commit `7eae6f35e89b5d1a28037bc03fda179edd612298` after a guarded workflow verified the exact parent head, encoded-payload checksum, decoded-patch checksum, patch applicability, and the focused source validators. This documentation commit exists to trigger the repository's normal CI from the authenticated branch author. Do not treat the older run 269 result as evidence for the current head.

## Review-thread reconciliation

All CodeRabbit and Qodo inline threads and top-level review findings were checked against the current effective diff. Valid findings were repaired. Release-signing findings were withdrawn as stale-base findings after the branch was synchronized with `main`; release workflow and release-security files are not part of the effective PR diff.

## Verification status

The final pull-request head `c3ae10c4886637e4029687cc13cef519bac5f285` passed GitHub Actions run `30965142253` with all seven jobs green before merge commit `045213834832d684abe9b88f8e634f89a9e7a20a` landed on `main`.

Verified evidence included:

- focused frontend-polish contracts: 8/8;
- source contracts: 14/14;
- locale parity and static translation references: 3 locales, 285 keys each;
- dependency-backed lint and frontend build;
- Rust tests and release smoke;
- container runtime smoke;
- accessibility and axe audits;
- TUI and daemon smoke;
- Windows release and performance gates;
- documentation, frontend-quality, CSS custom-property, action-pin, package-boundary, and module-size policies.

## Remaining release-candidate checks

- Manual screen-reader, native-shell, 200% zoom, and release-candidate visual review are not inferred from source inspection or the CI matrix.
- Final merge remains subject to repository approval and branch-protection policy.
- Future debt should be reported as scoped findings with reproducible evidence, not as a global “slop” score.
