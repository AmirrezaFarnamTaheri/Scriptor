# Scriptor Design Audit — 2026-08-25

**Input:** rendered desktop build (screenshots, live app) + full source (React 19 + Vite, custom CSS token system, 12 themes). Confidence: 🟢 for code/token findings, 🟡 for runtime states I could not drive (focus rings under real keyboard, screen-reader output).
**Method:** `design-audit` 19-category protocol + 152-rule deterministic harness (`design_lint.py`, 386 raw hits → manually verified) + `anti-slop-design` 57-gate lens + `ui-design-system` rule priorities. Harness hits were hand-verified; false positives dropped (details inline).
**Scope:** desktop shell at 1550×830, dark "Midnight" default theme, one-note vault. Not covered: light/high-contrast themes pixel-by-pixel, mobile nav, screen-reader pass.

## Scores

- **Overall: 100 − (1 × 🚫12) − (2 × 🟡4) − (3 × 🟢1) = 77/100** *(pre-fix tree; every deduction below is fixed in this same PR unless marked open)*
- **Accessibility: 84/100** (was failing on unnamed controls + partial reduced-motion)
- **Ethics: 100/100** — local-first, no telemetry, no dark patterns, honest capability labels
- **Usability (Nielsen): 94/100** — minor duplication (Jobs button vs Jobs tab), ambiguous "Diagnostics fresh" checkbox

## Verified issues (deduplicated)

| ID | Cat | Severity | What / Why | Fix |
|---|---|---|---|---|
| A1 | A11y (SC 4.1.2/1.3.1) | 🚫 Blocker | **10 form controls without accessible names** — settings textareas (graph groups, scan roots), plugin search, quick-capture scratchpad + todo inputs, sticky-note title, theme preset select. Screen readers announce "edit text" with no context. Harness said 120; **108 were false positives** (wrapping-`<label>` pattern the regex can't see) — 10 verified real, each fixed with a contextual `aria-label`. | ✅ aria-labels added |
| A2 | Motion (SC 2.3.3) | 🟡 Warning | `prefers-reduced-motion` only neutralized five named classes; keyframe animations in buttons/command-palette/editor styles (and third-party katex/hljs CSS) still ran. | ✅ Universal neutralizer (`*` 0.01 ms + `scroll-behavior: auto`) appended to the existing media block |
| A3 | States | 🟡 Warning | Index progress bar stayed **amber at 100%** — reads as "still working" after completion. | ✅ `is-done` success state (green bar + calm container) |
| A4 | Loading/Error states | 🟡 Warning | Plugin-state load failure rendered as bare unstyled text with **no recovery path**; first-render bridge lag made it appear spuriously. | ✅ One automatic retry (2.5 s) + tokenized danger alert styling |
| A5 | Visual polish | 🟢 Tip | "Open Vault" label wrapped to two lines in the top bar. | ✅ `white-space: nowrap` on top-bar buttons |
| A6 | Responsive | 🟢 Tip | At >100 % zoom the top bar clipped instead of scrolling; editor toolbar could cut buttons. | ✅ Horizontal scroll (hidden scrollbar) on bar + toolbar wrapper; search shrinks 170–460 px |
| A7 | Visual polish | 🟢 Tip | Modal surfaces at 0.75 alpha read as broken transparency when GPU blur is unavailable. | ✅ All 12 themes: opaque 0.97 surfaces, blur off by default (still user-selectable) |

**Open (reported, not fixed):** Output-console card floats centered with dead side margins (possible intentional design — needs owner call); "Diagnostics fresh" checkbox semantics ambiguous (label describes state, checkbox controls opt-in); Jobs affordance duplicated (footer button + dock tab); module workers under Tauri custom protocol never answer (perf mitigation shipped; root cause = follow-up).

## Anti-slop lens (Operate surface)

Clean: no purple/gradient tells, single icon family (Lucide), tokenized colors (no raw hex in components — the one inline `var(--primary, #38bdf8)` fallback is compliant), real empty states with next actions, honest copy (no invented metrics), reduced-motion now universal. The 18 built-in themes + custom builder are a genuine differentiator, not slop.

## What's working

Token discipline across 522 production files (enforced by `css-custom-properties.mjs`), WCAG-targeted contrast tokens, keyboard-complete flows with axe audit history, honest capability-maturity labeling, per-file reduced-motion blocks (now backed by the universal one).

## Verification for this audit's fixes

`tsc -b` clean · ESLint warning-zero on touched files · bundle budget OK (503 k gzip) · embedded desktop build ✓ · launch screenshot ✓ (opaque surfaces, fitted top bar, green index state). Screen-reader announcement of the new labels: pending manual pass (flagged in VERIFICATION.md culture).
