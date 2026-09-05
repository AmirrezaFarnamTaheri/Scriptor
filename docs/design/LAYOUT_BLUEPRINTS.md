# Layout Blueprints

Structural layout contracts for Scriptor across form factors.

## Desktop (≥1321px)

```
┌─────────────────────────────────────────────────────────────┐
│  Topbar (glass): brand · history · command search · actions │
├──────────┬──────────────────────────────┬───────────────────┤
│  Vault   │  Editor workspace            │  Inspector rail   │
│  318px   │  tabs · toolbar · editor     │  408px            │
│  sidebar │  optional split preview      │  plugins/health   │
├──────────┴──────────────────────────────┴───────────────────┤
│  Status strip: jobs · diagnostics · repo state             │
└─────────────────────────────────────────────────────────────┘
```

- **Command palette** (`Ctrl+K`) overlays center-top — primary navigation for power users.
- **Graph / Canvas / Settings** open as glass modal layers (`z-index: 60+`).
- Panels are independently scrollable; editor supports split preview with drag handle.
- Editor toolbar groups wrap inside the writing column. A bounded vertical scroll area keeps the toolbar from consuming short viewports; controls never extend underneath the inspector rail.
- Side rails are resizable and collapse to zero-width tracks. Their effective widths shrink with the available viewport so the editor retains space. The authoritative formulas are in `src/styles/app/foundation.css`.
- Each rail scrolls independently. Note-health and quality cards belong to the inspector and preview modes; the store shows its own sections directly.
- The status dock defaults to a collapsed strip and remembers the user's preference.

## Tablet and narrow desktop (821px – 1320px)

- Vault, editor, and inspector remain side-by-side with dynamically reduced rail widths; the inspector does not stack beneath the editor.
- The top bar stays one row while lower-priority controls yield space. Publish remains reachable through its workspace mode, and support through the command palette.
- Docked auxiliary panels reserve their actual width in the workspace.

## Mobile (≤820px)

```
┌─────────────────────────┐
│  Compact topbar         │
├─────────────────────────┤
│  Active workspace pane  │
│  (vault OR editor OR    │
│   inspector — one at    │
│   a time via bottom nav)│
├─────────────────────────┤
│  Mobile bottom dock     │
│  Vault · Write · Lens · │
│  Command                │
└─────────────────────────┘
```

- **Bottom dock** (`MobileWorkspaceNav`) switches primary pane without losing vault context.
- **Command** opens palette as bottom-anchored sheet on narrow viewports.
- Touch targets minimum 44px; thumb-reach zone for primary actions.

## Terminal (TUI)

```
┌ Command Surface ────────────────────────────────────────────┐
├ Notes (34%) ──┬── Preview / Backlinks / Graph / Health ─────┤
├───────────────┴─────────────────────────────────────────────┤
│ Footer: status · git · health · selection · key hints       │
└─────────────────────────────────────────────────────────────┘
```

- Vim-style `j/k` navigation; `/` search; `?` help overlay.
- `PgUp`/`PgDn` scroll preview panes; rich markdown rendering via pulldown-cmark.
- Daemon and in-process backends share identical keymap.

## Z-index stack

| Layer | z-index |
|-------|---------|
| Workspace grid | 0 |
| Status strip | 10 |
| Mobile dock | 40 |
| Overlays / modals | 60 |
| Command palette | 70 |
| Toasts | 80 |
