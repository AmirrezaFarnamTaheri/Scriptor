# Frontend UI architecture and polish implementation record

**Date:** 2026-08-04  
**Pull request:** #29  
**Status:** implementation and current-head CI complete; manual release-candidate checks remain

## Goal

Improve panel accessibility, state correctness, shortcut discoverability, and design-document consistency without inventing lifecycle state that the application does not own.

## Verified project baseline

- React 19, TypeScript 6, Vite 8, pnpm 10.33.0.
- Semantic CSS variables in `src/index.css` and `src/styles/`; Tailwind is not installed.
- Tauri 2 is the primary desktop shell; native authority is mediated by Rust commands and the authenticated daemon boundary.
- System or locally bundled fonts only.

## Implemented decisions

### Shared panel behavior

- `UnifiedPanelShell` provides modal labels, focus containment, Escape handling, focus restoration, and roving tab focus.
- Docked panels remain non-modal.
- The shell uses opacity-only entrance motion so fixed descendants remain viewport-relative.

### Shortcuts and tooltips

- Shortcut labels are derived for macOS versus Ctrl-based platforms.
- Visual tooltips are `aria-hidden` when the trigger already has a complete accessible name.
- Git, command-palette, sidebar, and inspector controls expose shortcut information to assistive technology.

### Git panel state and row semantics

- `useWorkspaceGit` owns status loading and error information.
- `selectGitPanelState` maps owned data to loading, error, non-repository, or ready presentation.
- Checkbox labels contain no nested buttons; row actions are adjacent controls.
- Memoized rows receive stable callbacks across selection-only changes.

### Plugin and MCP panels

- Empty states are retained where the current owner can determine emptiness.
- Unsupported loading/error props were removed rather than leaving unreachable UI branches.

### Documentation

- `DESIGN.md`, `GEMINI.md`, and `design-system/scriptor/MASTER.md` defer to executable manifests and CSS tokens.
- C4 diagrams describe the React, Tauri, daemon, MCP, and local-vault boundaries actually present in the repository.
- Duplicate task ledgers and unsupported completion certificates were removed.

## Regression coverage

- `scripts/validation/frontend-polish-contracts.test.mjs` covers Git panel state selection, row-label semantics, callback structure, shortcut names, and visual-tooltip accessibility.
- `scripts/validation/source-contracts.mjs` executes those focused contracts from the mandatory source-validation gate.
- `e2e/frontend-polish-regressions.spec.ts` adds rendered checks for Git row markup and shortcut accessibility.

## Evidence collected

The following completed successfully against the repaired source snapshot:

- `node scripts/validation/frontend-quality.mjs`
- `node scripts/validation/css-custom-properties.mjs`
- `node scripts/validation/action-pins.mjs`
- `node scripts/validation/deep-module-boundaries.mjs`
- `node scripts/validation/i18n-parity.mjs`
- `node scripts/validation/docs-contracts.mjs`
- `node scripts/validation/module-size-ratchet.mjs`
- `node scripts/validation/source-contracts.mjs`
- `node --experimental-strip-types --test scripts/validation/frontend-polish-contracts.test.mjs`
- GitHub Actions CI run `30929841904` (run 264): all seven jobs passed on head `171d0a2855419d41fe466c41fdec89448e8050d5`

## Not claimed by this record

- No React DevTools profiling trace was captured, so no universal 16 ms render claim is made.
- No blanket “zero slop” or “all asynchronous panels” claim is made.
- Manual screen-reader, native-shell, 200% zoom, and full visual-regression results remain release-candidate checks unless current CI or attached evidence proves them.
- The technical CI gate passed; final merge remains subject to repository approval and branch-protection policy.
