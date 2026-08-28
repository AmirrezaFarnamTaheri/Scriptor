# Whole-Stack Audit & Deslop Report — 2026-08-28

**Scope:** full working tree of `fix/ci-post-merge-compile-errors` (298 committed files vs `main` + 17 uncommitted + 2 untracked).
**Method:** regression-first (gates before and after every edit), five-axis review (correctness / readability / architecture / security / performance), design audit against `DESIGN.md`, CI supply-chain scan.

## 1. Quality Gates — ALL GREEN

| Gate | Command | Result |
|---|---|---|
| Typecheck | `pnpm exec tsc -b` | PASS (exit 0) — before and after edits |
| Lint (full repo) | `pnpm exec eslint .` | PASS |
| Lint (edited files) | `eslint <3 files>` | PASS |
| Source tests | `pnpm test:source` | PASS |
| Generated contracts | `pnpm check:contracts` | PASS |
| Packaging (zip-lite) | `pnpm check:packaging-profile` | PASS |

## 2. Review of Uncommitted WIP — Verdict: **Ship it (with nits)**

The hygiene batch is high quality:

- `App.tsx` + `lazyPanels.tsx` — six panels (incl. chart.js-bearing WritingTargetsPanel) moved to `lazy()` imports; main-bundle diet with correct Suspense fallbacks. **Good.**
- `useEscapeToClose.ts` — render-phase ref mutation moved into `useEffect`; complies with the project's own `react-hooks/refs: error` rule. **Good.**
- `useMcpRuntime.ts` — plugin tools now advertise an honest open `inputSchema` instead of a closed empty one, with rationale comment. **Good.**
- `outcome.ts` — `BoundaryOutcomeStatus` deleted; derived from the generated operation catalog (single source of truth). **Good architecture.**
- `hunspell-dictionary.ts` — 10 locales advertised without shipped assets removed (en-GB, de, fr, es, pt, it, nl, ru, ar, fa); honesty rule documented + enforced by new `dictionary-asset-contracts.test.mjs`. **Good — matches DESIGN.md "no claims without evidence".**
- `zip-lite.py` → `zip-lite.mjs` — removes the repo's only Python dependency; prune-during-traversal + fixed DOS timestamps for byte-reproducible archives; covered by `check:packaging-profile`. **Good.**
- `rename.rs` — narrowed imports. **Trivial.**
- **Nit:** `packages/mcp/src/server.ts` — `as const` → `as string` widens a literal type; acceptable post-catalog-refactor, but a `satisfies` or typed catalog accessor would preserve precision.
- Staged deletions (`dictionaries/en_US.dic`, `export-theme.css`, `zip-lite.py`) verified intentional; assets relocated to `public/dictionaries/` and covered by the new contract test.

## 3. Design Audit vs `DESIGN.md` — Compliant (3 glyph fixes applied)

Verified across 576 source files (src + packages + styles):

| Directive | Result |
|---|---|
| No purple/indigo AI gradients | ✅ only token *definitions* in `tokens/primitives.css` (brand accent + violet primitive scale) |
| No emojis as structural UI icons | ⚠️ 3 violations — **fixed** (below); `✗` in task `statusRegistry` is markup data, `📅` regex in e2e parses user content — both grounded |
| No layout-shifting hover scale | ✅ zero `hover:scale` |
| Lucide icon set | ✅ convention confirmed (8+ components use `<X />`); fixes below align stragglers |
| Semantic tokens, no arbitrary colors | ✅ 167 hex hits are the palette/theme systems themselves (`brand/palettes.ts`, ThemeCustomizer, canvas templates) |
| Keyboard focus | ✅ 19 `focus-visible` usages; aria-labels present on replaced buttons |
| Interaction states | ✅ `.icon-button` / `.theme-action-btn` ship full hover/active/disabled states |

**Applied fixes (3 files, 6 edits):**
- `PluginManagerCenter.tsx` — unstyled `close-button` + `✕` glyph → canonical `.icon-button` + `<X />`
- `ThemeCustomizerModal.tsx` — same swap
- `ThemeCard.tsx` — `✓` text glyph → `<Check />` (button CSS already reserves `gap: 6px` for icon+label)

## 4. Deslop Inventory — Zero masking fallbacks

| Smell | Count | Classification |
|---|---|---|
| `: any` / `as any` | **0 / 0** | clean |
| Empty catch blocks | **0** | clean |
| TODO/FIXME/HACK | **0** | clean |
| `console.log` in src | 8 | all in bench/e2e/xss fixtures — grounded |
| `eslint-disable` / `@ts-ignore` | 15 | all classified: 12× `exhaustive-deps` (registry-snapshot pattern with explicit `revision` keys — deliberate), 2× `react-refresh/only-export-components` (standard context-file pattern), 1× codemirror effect — grounded |
| Non-null `!.` in `useVaultWorkspace.ts` | 8 | safe today (`DEFAULT_VAULT_CONFIG` constant); fragile if config shape drifts — deferred hardening below |
| Largest non-generated file | `src/App.tsx` 1,933 lines | decomposition candidate for a future dedicated pass — deferred |

## 5. Setup & CI Audit — Exemplary, no blocking gaps

- **Actions pinned by full 40-char SHA** across all 9 workflows (strictest supply-chain practice).
- **Least-privilege `permissions:`** on every workflow (`contents: read` except release-kickoff `write`); `timeout-minutes` everywhere; caching where it pays (ci, publish-vault, visual-review).
- `.gitignore` covers all artifact dirs; `.perf-src-results.tmp.log` covered by `*.log` (initial flag was a false positive).
- tsconfig chain: `strict`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax`, `noFallthroughCasesInSwitch`, `erasableSyntaxOnly` — exemplary.
- Flat ESLint with `react-hooks/refs` + `set-state-in-effect` at `error` — above-average rigor.
- Dependency-cruiser config present (`.dependency-cruiser.cjs`).

## 6. Deferred (recommended follow-ups, not applied)

1. **`useVaultWorkspace.ts`**: type `DEFAULT_VAULT_CONFIG` with nested `Required<>` so the 8 non-null assertions become compile-time-guaranteed.
2. **`mcp/server.ts`**: restore literal precision on `MCP_CURRENT_SPEC_VERSION` (typed catalog accessor or `satisfies`).
3. **`App.tsx` (1,933 lines)**: dedicated decomposition pass (panel orchestration → feature modules).
4. **Suppression consolidation**: the 12 `exhaustive-deps` disables could collapse into one documented `useRegistrySnapshot(registry, revision)` hook.

## 7. Evidence

- Gates run before edits (baseline) and after edits (verification) — all green both times.
- No commits made; all changes remain uncommitted in the working tree alongside the existing WIP.

## 8. Design-Token & Contrast Audit (agents-visual-design-foundations)

**Method:** WCAG relative-luminance contrast computed programmatically for all 18 palette schemes × 4 pairs (ink/bg, ink/surface @ 4.5:1; primary/bg, amber/bg @ 3:1 UI), incl. rgba-over-bg blending for borders. Token architecture compared against modular-scale / 8-pt-grid / semantic-naming foundations.

### 8.1 Contrast results: 16/18 schemes pass; 2 verified defects

| Scheme | Pair | Computed | Threshold | Verified fix |
|---|---|---|---|---|
| `light` (Light Modern) | amber on bg `#f5f7fb` | **2.61:1** ✗ | 3:1 (UI/warning) | amber `#ea580c` → **3.32:1** (minimal hue shift; `#c2410c` = 4.83:1 if more headroom wanted) |
| `solarized-dark` | ink `#839496` on surface `#073642` | **4.11:1** ✗ | 4.5:1 (body text) | ink `#93a1a1` (canonical Solarized base1) → **4.86:1** surface, **5.61:1** bg |

All 17 other scheme pairs pass with margin (ink/bg ranges 4.75–21.0). Both fixes are palette-value changes and are **deliberately not applied**: they alter published "perfected" schemes and would invalidate visual-regression baselines (`screenshots.spec.ts-snapshots`). Owner decision; visual-review workflow should re-capture after any change.

### 8.2 Token architecture: exemplary primitives, but a 3-layer split with a dead layer

- **Primitives (`tokens/primitives.css`)** — exemplary: `--p-space-N` (N = px, strict 4-pt grid from 1px micro-steps to 8rem), `--p-text-*` (10→36px near-modular scale), `--p-radius-*` (0–16px + full).
- **Semantic layer (`tokens/semantic.css`)** — well-designed (`--space-inline-*`, `--space-stack-*`, `--text-body/heading-*` mapping to primitives, purpose-named)… but **0 usages across all 48 CSS files**. Aspirational/dead layer.
- **Legacy index.css scales** — `--space-1..8` (4–40px, used 19×) and `--text-xs..2xl` (11–26px, used 21×) duplicate the primitive roles with a different naming scheme; components also bypass directly to `--p-*` (9 + 7 uses).

**Finding:** three parallel spacing/type systems; the semantic one unused. Risk: drift (already visible: index.css `--text-base`=14px vs `--p-text-md`=16px semantic mapping vs `--p-text-base`=14px). **Recommendation:** declare one canonical path (semantic layer), migrate component CSS, keep legacy vars as aliases during transition, or delete `semantic.css` if it was speculative. (Usage counts cover CSS files only; inline TSX styles not counted.)

Minor notes: 2× hardcoded `--text: #ffffff` inside index.css theme blocks (should be `var(--ink)`); no `--icon-*` size tokens (icon sizing implicit via Lucide props); motion tokens are easings only (`--ease-fast/soft/gentle/spring`) — duration tokens absent (durations are inline in component CSS).

### 8.3 Verdict

Design-token hygiene is strong at the primitive level and contrast is excellent almost everywhere. The two contrast defects are cheap, verified fixes pending owner approval; the token-layer consolidation is the one structural follow-up worth scheduling.
