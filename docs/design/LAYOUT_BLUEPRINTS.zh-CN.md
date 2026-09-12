# 布局蓝图

[English](LAYOUT_BLUEPRINTS.md) · **简体中文** · [Русский](LAYOUT_BLUEPRINTS.ru.md) · [Deutsch](LAYOUT_BLUEPRINTS.de.md) · [Español](LAYOUT_BLUEPRINTS.es.md) · [فارسی](LAYOUT_BLUEPRINTS.fa.md)

Scriptor 在不同 form factor 上的结构布局 contract。

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

- **Command palette** (`Ctrl+K`) 覆盖在中上方，是 power user 的主导航。
- **Graph / Canvas / Settings** 作为 glass modal layer 打开（`z-index: 60+`）。
- panel 独立滚动；editor 支持带 drag handle 的 split preview。
- editor toolbar group 在写作列内换行；有界垂直滚动区避免 toolbar 占满矮 viewport；control 不得伸到 inspector rail 下方。
- side rail 可 resize 并 collapse 到零宽 track；有效宽度会随 viewport 缩小，以保留 editor 空间。权威公式位于 `src/styles/app/foundation.css`。
- 每条 rail 独立滚动。note-health/quality card 属于 inspector/preview mode；store 直接展示自己的 section。
- status dock 默认折叠，并记住用户偏好。

## Tablet 与窄 Desktop (821px–1320px)

- Vault、editor、inspector 保持并排，rail 宽度动态减小；inspector 不堆叠到 editor 下。
- top bar 保持一行，低优先级 control 让出空间。Publish 可从 workspace mode 进入，support 从 command palette 进入。
- Docked auxiliary panel 必须在 workspace 中预留真实宽度。

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

- **Bottom dock** (`MobileWorkspaceNav`) 在不丢失 vault context 的情况下切换主 pane。
- **Command** 在窄 viewport 中将 palette 作为底部 sheet 打开。
- Touch target 最小 44px；主 action 位于拇指可达区。

## Terminal (TUI)

```text
┌ Command Surface ────────────────────────────────────────────┐
├ Notes (34%) ──┬── Preview / Backlinks / Graph / Health ───┤
├───────────────┴────────────────────────────────────────────┤
│ Footer: status · git · health · selection · key hints      │
└────────────────────────────────────────────────────────────┘
```

- Vim 风格 `j/k` 导航；`/` 搜索；`?` help overlay。
- `PgUp`/`PgDn` 滚动 preview pane；通过 pulldown-cmark rich Markdown rendering。
- Daemon 与 in-process backend 使用完全相同 keymap。

## Z-index stack

| Layer | z-index |
|---|---|
| Workspace grid | 0 |
| Status strip | 10 |
| Mobile dock | 40 |
| Overlays / modals | 60 |
| Command palette | 70 |
| Toasts | 80 |
