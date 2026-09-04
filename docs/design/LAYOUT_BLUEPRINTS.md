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
- The side rails start at `1321px`, not at a nominal desktop width: a `318px` sidebar plus a `408px`
  inspector leaves the editor under `600px` below that, so the grid switches to the arrangement
  described next instead of squeezing the editor. Both rails are user-resizable (`200`–`600px` and
  `300`–`800px`, persisted) and collapse to zero-width tracks when toggled, so what is reserved is
  the current width, not a fixed tax. Enforced by `src/styles/app/foundation.css` and
  `src/styles/app/responsive.css`.

- The inspector is a grid track, never an overlay: nothing draws over the editor, and the panel's own
  cards can be clipped by it. Collapsing zeroes its track and its gutter together.

## Tablet and narrow desktop (821px – 1320px)

- Vault + editor remain side-by-side (`280px | 1fr`).
- Inspector drops below editor as a two-column grid spanning full width, capped at
  `min(36dvh, 400px)`, with the resizer gutters hidden.
- The topbar stays a single band: below `1500px` it becomes a two-column grid (brand + command search,
  then status actions) instead of wrapping into a second toolbar row. Workspace mode tabs scroll in place
  rather than wrapping.

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
