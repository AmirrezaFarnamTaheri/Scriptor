# Схемы компоновки

[English](LAYOUT_BLUEPRINTS.md) · [简体中文](LAYOUT_BLUEPRINTS.zh-CN.md) · **Русский** · [Deutsch](LAYOUT_BLUEPRINTS.de.md) · [Español](LAYOUT_BLUEPRINTS.es.md) · [فارسی](LAYOUT_BLUEPRINTS.fa.md)

Структурные контракты компоновки Scriptor для разных form factors.

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

- **Command palette** (`Ctrl+K`) перекрывает верхнюю центральную область и является основной навигацией power users.
- **Graph / Canvas / Settings** открываются как glass modal layers (`z-index: 60+`).
- Panels прокручиваются независимо; editor поддерживает split preview с drag handle.
- Группы toolbar переносятся внутри writing column. Ограниченная вертикальная прокрутка не даёт toolbar занимать короткий viewport; controls не заходят под inspector rail.
- Side rails изменяют размер и схлопываются до zero-width tracks. Effective width уменьшается вместе с viewport, сохраняя место editor. Канонические формулы находятся в `src/styles/app/foundation.css`.
- Каждая rail прокручивается независимо. Note-health/quality cards принадлежат inspector/preview modes; store показывает собственные sections напрямую.
- Status dock по умолчанию collapsed и запоминает выбор пользователя.

## Tablet и узкий Desktop (821px–1320px)

- Vault, editor и inspector остаются рядом с динамически уменьшенными rails; inspector не уходит под editor.
- Top bar остаётся одной строкой, низкоприоритетные controls уступают место. Publish доступен через workspace mode, support — через command palette.
- Docked auxiliary panels резервируют реальную ширину в workspace.

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

- **Bottom dock** (`MobileWorkspaceNav`) переключает основную pane, не теряя vault context.
- **Command** открывает palette как bottom-anchored sheet на узких viewport.
- Touch targets минимум 44px; основные действия — в thumb-reach zone.

## Terminal (TUI)

```text
┌ Command Surface ────────────────────────────────────────────┐
├ Notes (34%) ──┬── Preview / Backlinks / Graph / Health ───┤
├───────────────┴────────────────────────────────────────────┤
│ Footer: status · git · health · selection · key hints      │
└────────────────────────────────────────────────────────────┘
```

- Vim-style `j/k`; `/` search; `?` help overlay.
- `PgUp`/`PgDn` прокручивают preview panes; rich Markdown через pulldown-cmark.
- Daemon и in-process backends используют одинаковый keymap.

## Z-index stack

| Layer | z-index |
|---|---|
| Workspace grid | 0 |
| Status strip | 10 |
| Mobile dock | 40 |
| Overlays / modals | 60 |
| Command palette | 70 |
| Toasts | 80 |
