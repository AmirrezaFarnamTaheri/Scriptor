# Layout-Blueprints

[English](LAYOUT_BLUEPRINTS.md) · [简体中文](LAYOUT_BLUEPRINTS.zh-CN.md) · [Русский](LAYOUT_BLUEPRINTS.ru.md) · **Deutsch** · [Español](LAYOUT_BLUEPRINTS.es.md) · [فارسی](LAYOUT_BLUEPRINTS.fa.md)

Strukturelle Layout-Verträge für Scriptor über verschiedene Formfaktoren.

## Desktop (≥1321px)

```text
┌─────────────────────────────────────────────────────────────┐
│  Topbar (glass): brand · history · command search · actions │
├──────────┬──────────────────────────────┬───────────────────┤
│  Vault   │  Editor workspace           │  Inspector rail   │
│  318px   │  tabs · toolbar · editor    │  408px            │
│  sidebar │  optional split preview     │  plugins/health   │
├──────────┴──────────────────────────────┴───────────────────┤
│  Status strip: jobs · diagnostics · repo state             │
└─────────────────────────────────────────────────────────────┘
```

- **Command Palette** (`Ctrl+K`) liegt mittig oben als primäre Navigation für Power User.
- **Graph / Canvas / Settings** öffnen als Glass Modal Layers (`z-index: 60+`).
- Panels scrollen unabhängig; Editor unterstützt Split Preview mit Drag Handle.
- Editor-Toolbar-Gruppen umbrechen innerhalb der Schreibspalte. Ein begrenzter vertikaler Scrollbereich verhindert, dass die Toolbar kurze Viewports übernimmt; Controls reichen nie unter die Inspector Rail.
- Side Rails sind resizable und kollabieren zu zero-width tracks. Ihre effektive Breite schrumpft mit dem Viewport, damit Platz für den Editor bleibt. Maßgebliche Formeln stehen in `src/styles/app/foundation.css`.
- Jede Rail scrollt unabhängig. Note-Health-/Quality-Cards gehören zu Inspector/Preview Modes; der Store zeigt eigene Sections direkt.
- Status Dock ist standardmäßig collapsed und merkt sich die Nutzerpräferenz.

## Tablet und schmaler Desktop (821px–1320px)

- Vault, Editor und Inspector bleiben nebeneinander mit dynamisch reduzierten Rail-Breiten; der Inspector stapelt nicht unter dem Editor.
- Top Bar bleibt einzeilig, niedrig priorisierte Controls geben Raum frei. Publish bleibt über Workspace Mode erreichbar, Support über Command Palette.
- Docked Auxiliary Panels reservieren ihre tatsächliche Breite im Workspace.

## Mobile (≤820px)

```text
┌─────────────────────────┐
│  Compact topbar         │
├─────────────────────────┤
│  Active workspace pane  │
│  vault OR editor OR     │
│  inspector — one at a   │
│  time via bottom nav    │
├─────────────────────────┤
│  Mobile bottom dock     │
│  Vault · Write · Lens · │
│  Command                │
└─────────────────────────┘
```

- **Bottom Dock** (`MobileWorkspaceNav`) wechselt die primäre Pane ohne Verlust des Vault Context.
- **Command** öffnet die Palette auf schmalen Viewports als bottom-anchored sheet.
- Touch Targets mindestens 44px; primäre Aktionen in Thumb-Reach Zone.

## Terminal (TUI)

```text
┌ Command Surface ────────────────────────────────────────────┐
├ Notes (34%) ──┬── Preview / Backlinks / Graph / Health ───┤
├───────────────┴────────────────────────────────────────────┤
│ Footer: status · git · health · selection · key hints      │
└────────────────────────────────────────────────────────────┘
```

- Vim-artige `j/k`-Navigation; `/` Suche; `?` Help Overlay.
- `PgUp`/`PgDn` scrollen Preview Panes; Rich Markdown Rendering über pulldown-cmark.
- Daemon und In-Process Backends teilen denselben Keymap.

## Z-index stack

| Layer | z-index |
|---|---|
| Workspace grid | 0 |
| Status strip | 10 |
| Mobile dock | 40 |
| Overlays / modals | 60 |
| Command palette | 70 |
| Toasts | 80 |
