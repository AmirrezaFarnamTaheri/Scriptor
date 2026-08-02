# Accessibility Audit

Release checklist for Scriptor desktop. Automated static checks run via `pnpm check:a11y`; items below note what CI covers vs what needs manual spot-check before tagging.

## Keyboard

- [ ] Tab order reaches vault search, note list, editor, inspector tabs, and status controls without traps *(manual release gate)*.
- [x] `Escape` closes graph panel, rename dialog, diagnostics drawer, Git panel, and other modal overlays (`useEscapeToClose`).
- [x] Shared panels, graph, and Obsidian import trap focus while modal and restore prior focus on close (`useFocusTrap`).
- [x] Note tabs expose separate activate, pin, and close controls without nested interactive elements; Arrow/Home/End navigation is supported.
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
- [x] `prefers-reduced-motion` respected (application CSS disables nonessential animations).

## Screen reader (spot check)

- [x] Vault note count and index progress announced via status region.
- [ ] Problems tab issue count *(manual with screen reader)*.
- [x] Diagnostics opt-in checkbox labeled "Send local crash diagnostics".

## Automated helpers

```powershell
pnpm check:a11y
```

Static source checks run in CI/release gates. For browser coverage:

```powershell
pnpm dev --host 127.0.0.1
pnpm check:a11y-axe
pnpm test:visual
```

Document findings in the release PR. Keyboard traps, missing names on primary actions, focus loss,
unreadable contrast, and critical/serious axe violations block release.

## Known limitations (v0.1)

- Graph panel uses one keyboard focus surface with arrow navigation, Enter activation, a live node summary, and modal focus containment. A screen-reader usability pass remains a manual release gate.
- Command palette supports arrow keys, Enter, and Escape (`CommandPalette.tsx`).
