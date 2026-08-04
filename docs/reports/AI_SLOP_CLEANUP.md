# Frontend UI cleanup review report

**Date:** 2026-08-04  
**Scope:** Pull request #29  
**Status:** reviewed and corrected; current-head CI pending

## Purpose

This report records concrete defects removed from the frontend-polish change set. It is not a certificate that the repository contains no remaining debt.

## Corrected defects

- **Unreachable Git loading and error states:** status lifecycle now originates in `useWorkspaceGit` and is selected through a pure state helper.
- **Stale Git commit selections:** paths removed by a status refresh are filtered before commit selection is derived.
- **Invalid interactive markup:** Git row buttons were moved outside the checkbox label and associated with the checkbox through `htmlFor`.
- **Memoization defeated by inline callbacks:** row handlers now originate at the parent and remain stable across selection-only changes.
- **Tooltip accessibility ambiguity:** visual tooltip content is hidden from assistive technology while triggers expose complete accessible names.
- **Fixed overlay containment risk:** the shared panel shell no longer uses a transform that changes the containing block of fixed descendants.
- **MCP empty-state regressions:** decorative icon semantics and localized copy are corrected, while drafts and audit remain accessible when no tools are registered.
- **Unowned async states:** plugin and MCP loading/error APIs that callers could not truthfully supply were removed.
- **Documentation drift:** React, TypeScript, Vite, CSS, Tauri, daemon, MCP, token, and font guidance now points to executable sources of truth.
- **Unsupported completion claims:** duplicate task ledgers and claims of universal sub-16 ms rendering, complete visual validation, or zero remaining debt were removed.

## Focused regression evidence

- `scripts/validation/frontend-polish-contracts.test.mjs`
- `scripts/validation/source-contracts.mjs`
- `e2e/frontend-polish-regressions.spec.ts`

The focused contracts cover Git state selection, stale selection removal, row semantics, MCP tab availability and localization, shortcut accessibility, and visual-tooltip behavior. Current-head results must come from the workflow run for the commit containing these changes.

## Review-thread reconciliation

All CodeRabbit and Qodo inline threads and top-level review findings were checked against the current effective diff. Valid findings were repaired. Release-signing findings were withdrawn as stale-base findings after the branch was synchronized with `main`; release workflow and release-security files are not part of the effective PR diff.

## Verification status

GitHub Actions run `30935422401` (CI run 265) passed all seven jobs on parent head `8f1032af3615712794aac22152496ee88b2d891b`. That run is historical evidence only because the final review-reconciliation commit changes code, tests, translations, and documentation. The new head requires a fresh successful CI run before a merge-readiness claim is made.

## Remaining release-candidate checks

- Manual screen-reader, native-shell, 200% zoom, and release-candidate visual review are not inferred from source inspection or the CI matrix.
- Final merge remains subject to repository approval and branch-protection policy.
- Future debt should be reported as scoped findings with reproducible evidence, not as a global “slop” score.
