# MAT-020: Kanban geometry check under panel scale animation

## Problem and observed evidence
The shared visual/browser test `e2e/report-remediation.spec.ts` used `clientWidth` (layout pixels) for board availability but `getBoundingClientRect` (transformed pixels) for column usage. Scriptor's `.unified-panel-shell:not(.unified-panel-docked)` animates `scale-in` from 0.95 to 1 over 180ms. A passing layout can therefore fail when sampled during the opening transform.

Observed on the existing MAT-018 branch, unchanged source `7896f9e`:
- [CI #40906856518](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40906856518) / Browser E2E: 511 tests passed and one failed, `desktop kanban columns use the available board width`.
- Required width >= 990 CSS pixels; transformed `getBoundingClientRect` measured 981.3316. This is a mismatch of measurement coordinate systems, not evidence that the flex board fails to fill its layout box.
- `e2e/visual-detail-probes.spec.ts` already explains the same transient transform issue for other panel tests.

## Focused correction
- Use layout-space `offsetLeft` and `offsetWidth` for the first-to-last column span, compared with the existing layout-space `clientWidth` minus computed padding.
- Exercise the same requirement both during normal UI and with an explicit temporary `scale(.95)` on the board. Both must fill the available layout width to within the existing eight-pixel tolerance.
- Do not change Kanban layout CSS, feature behavior, the threshold, the panel animation, the browser fixture, or unrelated PR #216.

## Verification
- **Observed RED:** existing real browser assertion failed in CI #40906856518; no claim of a new test-only intermediate RED head.
- **Pending:** exact-head functional/browser E2E, source regression suite, responsive/visual and documentation checks.
- **Remaining MAT-020 scope:** real 320/375/768/1024/1440 screens, 200% zoom, keyboard/RTL/high-contrast and layout consistency across other panels, installed-client acceptance. This PR does not complete MAT-020.
