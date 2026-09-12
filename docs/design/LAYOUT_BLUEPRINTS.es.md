# Planos de layout

[English](LAYOUT_BLUEPRINTS.md) · [简体中文](LAYOUT_BLUEPRINTS.zh-CN.md) · [Русский](LAYOUT_BLUEPRINTS.ru.md) · [Deutsch](LAYOUT_BLUEPRINTS.de.md) · **Español** · [فارسی](LAYOUT_BLUEPRINTS.fa.md)

Contratos estructurales de layout de Scriptor para distintos form factors.

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

- **Command palette** (`Ctrl+K`) se superpone arriba al centro y es la navegación principal para power users.
- **Graph / Canvas / Settings** se abren como glass modal layers (`z-index: 60+`).
- Los panels hacen scroll independiente; el editor admite split preview con drag handle.
- Los grupos de toolbar se envuelven dentro de la writing column. Un área de scroll vertical acotada evita que la toolbar consuma viewports bajos; los controles nunca se extienden bajo el inspector rail.
- Las side rails son redimensionables y colapsan a tracks de ancho cero. Su ancho efectivo disminuye con el viewport para conservar espacio del editor. Fórmulas autoritativas en `src/styles/app/foundation.css`.
- Cada rail hace scroll de forma independiente. Cards de note-health/quality pertenecen a inspector/preview; store muestra sus propias secciones directamente.
- Status dock está collapsed por defecto y recuerda la preferencia del usuario.

## Tablet y desktop estrecho (821px–1320px)

- Vault, editor e inspector permanecen en paralelo con rail widths reducidos dinámicamente; inspector no se apila debajo del editor.
- Top bar se mantiene en una fila mientras controles de menor prioridad ceden espacio. Publish sigue accesible por workspace mode y support por command palette.
- Docked auxiliary panels reservan su ancho real en el workspace.

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

- **Bottom dock** (`MobileWorkspaceNav`) cambia la pane principal sin perder vault context.
- **Command** abre palette como sheet anclada abajo en viewports estrechos.
- Touch targets mínimo 44px; primary actions dentro de thumb-reach zone.

## Terminal (TUI)

```text
┌ Command Surface ────────────────────────────────────────────┐
├ Notes (34%) ──┬── Preview / Backlinks / Graph / Health ───┤
├───────────────┴────────────────────────────────────────────┤
│ Footer: status · git · health · selection · key hints      │
└────────────────────────────────────────────────────────────┘
```

- Navegación estilo Vim `j/k`; `/` búsqueda; `?` help overlay.
- `PgUp`/`PgDn` desplazan preview panes; rich Markdown rendering mediante pulldown-cmark.
- Daemon e in-process backends comparten keymap idéntico.

## Z-index stack

| Layer | z-index |
|---|---|
| Workspace grid | 0 |
| Status strip | 10 |
| Mobile dock | 40 |
| Overlays / modals | 60 |
| Command palette | 70 |
| Toasts | 80 |
