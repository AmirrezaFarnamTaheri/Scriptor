# 无障碍审计

[English](ACCESSIBILITY_AUDIT.md) · **简体中文** · [Русский](ACCESSIBILITY_AUDIT.ru.md) · [Deutsch](ACCESSIBILITY_AUDIT.de.md) · [Español](ACCESSIBILITY_AUDIT.es.md) · [فارسی](ACCESSIBILITY_AUDIT.fa.md)

Scriptor 桌面版的 release checklist。自动静态检查通过 `pnpm check:a11y` 运行；下列项目注明 CI 已覆盖的内容，以及打 tag 前仍需人工 spot-check 的内容。

## Keyboard

- [ ] Tab order 能无陷阱到达 vault search、note list、editor、inspector tabs 与 status controls。*（manual release gate）*
- [x] `Escape` 关闭 graph panel、rename dialog、diagnostics drawer、Git panel 与其他 modal overlay（`useEscapeToClose`）。
- [x] Shared panel、graph 与 Obsidian import 在 modal 状态下 trap focus，并在关闭时恢复之前的 focus（`useFocusTrap`）。
- [x] Note tab 暴露独立 activate、pin、close control，不嵌套 interactive element，并支持 Arrow/Home/End navigation。
- [x] Editor 接受标准文本输入；CodeMirror focus ring 使用 `--focus-ring` / `--focus-outline` token。
- [x] Toolbar 与 close button 的 icon button 暴露 `aria-label`（shell component spot-check）。

## Landmarks 与名称

- [x] `main` shell 通过 `BRAND_WORKSPACE_LABEL` 标记。*（由 `check:a11y` 验证）*
- [x] Vault、editor 与 inspector region 使用 `aria-label` 或 heading。
- [x] Inspector 与 note tab 使用 `role="tablist"` / `role="tab"` 与 `aria-selected`。
- [x] Status banner 对错误使用 `role="status"` 或 `role="alert"`。*（由 `check:a11y` 验证）*

## Visual

- [ ] 默认 dark theme 的文字对比度符合 WCAG AA。*（人工 spot-check）*
- [x] Focus indicator 定义在 `src/index.css`。*（由 `check:a11y` 验证）*
- [x] 尊重 `prefers-reduced-motion`；应用 CSS 禁用非必要动画。

## Screen reader（spot check）

- [x] Vault note count 与 index progress 通过 status region 宣告。
- [ ] Problems tab issue count。*（使用 screen reader 人工检查）*
- [x] Diagnostics opt-in checkbox 标记为 “Send local crash diagnostics”。

## 自动化辅助

```powershell
pnpm check:a11y
```

静态 source check 在 CI/release gate 中运行。Browser coverage：

```powershell
pnpm dev --host 127.0.0.1
pnpm check:a11y-axe
pnpm test:visual
```

将 findings 记录在 release PR 中。Keyboard trap、primary action 缺失名称、focus 丢失、不可读 contrast、critical/serious axe violation 都会阻塞 release。

## 已知限制（v0.1）

- Graph panel 使用一个 keyboard focus surface，支持 arrow navigation、Enter activation、live node summary 与 modal focus containment。Screen-reader usability pass 仍是人工 release gate。
- Command palette 支持 arrow keys、Enter 和 Escape（`CommandPalette.tsx`）。
