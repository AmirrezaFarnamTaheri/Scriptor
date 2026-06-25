# Accessibility Audit

Release checklist for Scriptor desktop. Automated static checks run via `pnpm check:a11y`; items below note what CI covers vs what needs manual spot-check before tagging.

## Keyboard

- [ ] Tab order reaches vault search, note list, editor, inspector tabs, and status controls without traps *(manual)*.
- [x] `Escape` closes graph panel, rename dialog, diagnostics drawer, Git panel, and other modal overlays (`useEscapeToClose`).
- [x] Editor accepts standard text input; CodeMirror focus ring uses `--focus-ring` / `--focus-outline` tokens.
- [x] Icon buttons expose `aria-label` on toolbars and close buttons (spot-checked in shell components).

## Landmarks and names

- [x] `main` shell labeled via `BRAND_WORKSPACE_LABEL` *(verified by `check:a11y`)*.
- [x] Vault, editor, and inspector regions use `aria-label` or headings.
- [x] Inspector and note tabs use `role="tablist"` / `role="tab"` with `aria-selected`.
- [x] Status banners use `role="status"` or `role="alert"` for errors *(verified by `check:a11y`)*.

## Visual

- [ ] Text contrast meets WCAG AA on default dark theme *(manual spot-check)*.
- [x] Focus indicators defined in `src/index.css` *(verified by `check:a11y`)*.
- [x] `prefers-reduced-motion` respected (`App.css` media query disables animations).

## Screen reader (spot check)

- [x] Vault note count and index progress announced via status region.
- [ ] Problems tab issue count *(manual with screen reader)*.
- [x] Diagnostics opt-in checkbox labeled "Send local crash diagnostics".

## Automated helpers

```powershell
pnpm check:a11y
```

Static shell checks run in CI/release gate. For deeper coverage, use browser devtools axe on `pnpm dev`:

```powershell
pnpm dev --host 127.0.0.1
```

Document findings in the release PR. Block release only on **critical** issues (keyboard trap, missing labels on primary actions, unreadable contrast).

## Known limitations (v0.1)

- Graph panel exposes an off-screen node list (`aria-live`) for screen-reader summaries; interactive node exploration remains pointer-driven.
- Command palette supports arrow keys, Enter, and Escape (`CommandPalette.tsx`).
