[English](README.md) · [فارسی](README.fa.md) · **简体中文** · [Русский](README.ru.md) · [Deutsch](README.de.md) · [Español](README.es.md)

# Scriptor 截图

用于文档和营销的截图，由 Playwright 在 E2E 模式生成。

## 可用截图

| 截图 | 说明 | 使用位置 |
|---|---|---|
| workspace-light.png | 已审查的浅色 workspace | README / docs |
| workspace-dark.png | 已审查的深色 workspace | Docs + 稳定视觉覆盖 |
| workspace-tablet.png | 1024 px workspace 断点 | VISUAL-REVIEW |
| workspace-mobile.png | 820 px 响应式 workspace | VISUAL-REVIEW |
| editor-preview.png | 已审查的 editor/preview 分栏 | Docs + 稳定视觉覆盖 |
| inspector-preview.png | 带 editor/preview 控件的 Inspector | VISUAL-REVIEW |
| command-palette.png | 已审查的 command palette | Docs + 稳定视觉覆盖 |
| graph.png | 已审查的 graph | Docs + 稳定视觉覆盖 |
| canvas.png | 用于可视化排列笔记的空间 Canvas | VISUAL-REVIEW, STORE-MIGRATION, CAPABILITIES |
| git-panel.png | 版本控制状态、commit、pull/push | VISUAL-REVIEW, STORE-MIGRATION |
| mcp-panel.png | 已审查 MCP panel | Docs + 稳定视觉覆盖 |
| settings.png | Runtime/vault config、外观、诊断 | VISUAL-REVIEW, STORE-MIGRATION |
| publish-center.png | 已审查 Publish Center | Docs + 稳定视觉覆盖 |
| vault-health.png | 带 lint 和 health score 的 vault dashboard | VISUAL-REVIEW, RELEASE-CHECKLIST |
| knowledge-workbench.png | Knowledge Workbench | VISUAL-REVIEW |
| conflict-resolver.png | 3-way merge，按 hunk 选择 ours/theirs | VISUAL-REVIEW, STORE-MIGRATION |
| note-history.png | 可 restore 的修订时间线 | VISUAL-REVIEW |
| keyboard-shortcuts.png | 快捷键编辑器 | VISUAL-REVIEW |
| onboarding-tour.png | 首次运行产品导览 | VISUAL-REVIEW |
| plugins.png | Plugin marketplace 发现与管理 | VISUAL-REVIEW, STORE-MIGRATION, CAPABILITIES |
| editor-recovery.png | Editor recovery fallback | VISUAL-REVIEW, RELEASE-CHECKLIST |
| mcp-sharing-inventory.png | MCP sharing 与资源 inventory | VISUAL-REVIEW |
| toolbar-typography.png | Typography toolbar popover | VISUAL-REVIEW |
| toolbar-insert.png | Insert toolbar popover | VISUAL-REVIEW |
| mobile-inspector.png | 390 px mobile inspector | VISUAL-REVIEW |
| mobile-vault.png | 390 px mobile vault | VISUAL-REVIEW |

### 新鲜度与接受标准

文档 PNG 是**基于当前源码的新鲜截图**，不是已存 Playwright comparison baseline 的副本。测试首先将稳定后的页面直接捕获到 `docs/assets/screenshots/`，随后独立执行 `toHaveScreenshot`，与 `e2e/screenshots.spec.ts-snapshots/` 中稳定 Windows baseline 比较。

这种分离是有意的。若当前渲染差异仍在配置的视觉容差内，旧 baseline 仍可被接受；如果再把旧 baseline 覆盖回新鲜文档图，即使视觉回归测试通过，文档也会过期。

稳定 Windows baseline 仍是视觉回归的接受面。刻意的像素变更必须审查，并使用 `--update-snapshots=all` 明确刷新；绝不能通过提高全局容差隐藏视觉失败。

响应式与状态审查截图（`workspace-mobile`、`workspace-tablet`、mobile vault/inspector、editor recovery、MCP inventory、toolbar popover）来自实时测试输出；除非测试明确使用 `toHaveScreenshot`，否则不会晋升为稳定像素 baseline。

## 重新生成

截图由 Playwright E2E 生成。Mock IPC bridge 提供 fixture data，不需要真实 vault 或 Tauri binary。Capture 会等待字体、可见图片、lazy panel、有限 transition 以及非 degraded preview state 后才写入文档像素。

普通本地文档截图：

```powershell
pnpm screenshots:capture:web
```

在固定 Windows 环境刻意刷新视觉 baseline：

```powershell
./scripts/screenshots/capture.ps1 -SkipDesktopBuild -UpdateBaselines
```

`-UpdateBaselines` 使用 `--update-snapshots=all` 重新生成全部稳定 Windows snapshots，从最新 Playwright 输出刷新 docs-only 状态截图，并保留 `screenshots.spec.ts` 写入的文档截图。它**不会**把存储的 baseline PNG 覆盖到 docs 目录。

仓库还提供手动 **Refresh documentation screenshots** workflow。请在 review branch 而非 `main` 上运行。它使用固定 `windows-2025` runner 与 Edge，执行 capture contract tests，重新生成 docs 与稳定 Windows baseline，在不更新 snapshot 的情况下验证完整 visual suite，并只将生成的 PNG 变更提交回所选分支。

### E2E 模式 build

```powershell
pnpm exec vite build --mode e2e
```

该模式下 Vite 加载 `.env.e2e`；不要在 parent shell 导出 `VITE_E2E_MODE`。E2E build 在 Playwright config 中使用隔离输出目录。若 E2E 环境泄漏到 release assets，production bundle validation 会拒绝 test-only fault-injection marker。

### 运行 Playwright screenshot tests

```powershell
$env:VITE_SCREENSHOT_MODE = 'true'
$env:SCRIPTOR_CAPTURE_SCREENSHOTS = 'true'
pnpm exec playwright test --config playwright.e2e.config.ts e2e/screenshots.spec.ts --workers=1
```

### 覆盖浏览器 channel

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chrome'
```

## 架构

Screenshot pipeline 使用与功能测试相同的 E2E mock IPC bridge：

- **`playwright.e2e.config.ts`** — E2E 与文档截图配置
- **`playwright.visual.config.ts`** — 稳定视觉回归和状态审查
- **`e2e/screenshots.spec.ts`** — 稳定场景；写入新鲜 docs capture 并验证 baseline
- **`e2e/visual-review.spec.ts`** — responsive/state-review evidence
- **`scripts/screenshots/capture.ps1`** — 确定性 capture/orchestration contract
- **`scripts/validation/screenshot-capture-contracts.test.mjs`** — 防止旧 baseline 覆盖新鲜文档图的回归 guard
- **`src/e2e/bootstrap.ts`** — 提供 vault、Git、indexer、export fixture 的 mock IPC bridge
- **`src/e2e/state.ts`** — mock vault 的 in-memory note state
- **`src/screenshot/fixture.ts`** — vault、scan、graph、health diagnostics fixture

UI 变更影响 layout 或 copy 后，应重新生成并审查 PNG。请在 release PR 中记录 browser/channel、OS、source commit、viewport 和结果。参见 [`../../validation/FRONTEND_QUALITY.zh-CN.md`](../../validation/FRONTEND_QUALITY.zh-CN.md)。
