# Layout Blueprints

Structural layout contracts for Scriptor across form factors.

## Desktop (≥1181px)

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

## Tablet (821px – 1180px)

- Vault + editor remain side-by-side (`280px | 1fr`).
- Inspector drops below editor as a two-column grid spanning full width.
- Topbar wraps; command search moves to full width row.

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
