# 验证

[English](VERIFICATION.md) · [فارسی](VERIFICATION.fa.md) · **简体中文** · [Русский](VERIFICATION.ru.md) · [Deutsch](VERIFICATION.de.md) · [Español](VERIFICATION.es.md)

每项结果必须注明准确源提交、环境、目标架构和产物。旧提交的结果不能证明新实现已通过验证。

## 证据与当前状态

本轮审查的所有可执行验证都在 GitHub 托管工作机进行。本轮不授权本地应用运行、安装、测试、构建、lint、类型检查或格式化。源代码审查和编写的回归测试与实际通过的执行结果分开记录。

| 证据 | 含义 |
|---|---|
| 已验证 | 指定命令在指定源代码上执行并通过。 |
| 已静态验证 | 不运行产品，解析并检查代码或元数据。 |
| 已审阅 | 检查代码、契约或图片，没有执行证明。 |
| 待完成 | 所需执行或人工证据尚未取得。 |
| 失败 | 指定命令执行但未通过。 |

[Google 记录](validation/GOOGLE-INTEGRATIONS-2026-10-09.md)包含五项服务范围、工作机结果及提供商限制。[依赖限制](validation/SUPPLY-CHAIN-2026-10-04.md)不会因无关检查通过而解除。

当前证据保存在注明日期的记录中：[产品审查](validation/CROSS-PRODUCT-REVIEW-2026-10-04.md)、[缩放审查](validation/LEGACY-DIALOG-ZOOM-2026-10-08.md)、[截图来源](validation/SCREENSHOT-REFRESH-2026-10-08.md)、[工作区自定义](validation/WORKSPACE-SHORTCUTS-2026-10-08.md)及[历史验证](validation/HISTORICAL_VERIFICATION.md)。此前中文版[原文归档](validation/localized-verification-history/VERIFICATION.zh-CN.md)。历史数字是来源记录，不代表当前完成状态。维护中的文档必须本地化；来源敏感的审计和归档文档除外。

## 仓库检查

托管工作机从仓库根目录运行：

```bash
pnpm check:source
pnpm check:governance
pnpm check:mcp
pnpm check:plugins
pnpm check:canvas
pnpm check:editor
pnpm check:portal
pnpm check:renderer
pnpm check:export
pnpm check:headless
pnpm check:citations
pnpm check:knowledge
pnpm check:merge
```

`check:source`覆盖 IPC 契约、Rust 模块/进程/unsafe 策略、原生授权、前端策略、职责边界、性能工具、发布信任和 RustSec 例外。`check:governance`覆盖版本一致性、不可变 Actions、包边界、语言及文档/许可契约。

## 完整工程门禁

候选版本需要干净的 GitHub 环境、仓库清单固定的工具链与冻结锁文件：

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm lint
pnpm check:contracts
pnpm build
pnpm check:release
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
cargo deny check
pnpm audit --prod
```

`pnpm build`包括生产包图和初始 gzip 预算检查；`pnpm lint`不允许 ESLint 警告。`check:release`在 Linux/macOS 也需要 PowerShell 7（`pwsh`）。axe 需要兼容 Chrome 的 ChromeDriver；自动发现不可用时，将 `CHROMEWEBDRIVER`设为驱动所在目录。

## 界面与无障碍

```bash
pnpm test:e2e
pnpm test:visual
pnpm check:a11y
pnpm check:a11y-axe
```

人工矩阵包括 320/375/768/1024/1440 CSS 像素、浅色/深色/高对比主题、Windows/macOS/Linux、仅键盘操作、屏幕阅读器、200% 文本缩放、减少动态效果以及空、加载、错误、成功、破坏性确认和长内容状态。

Typography/Insert 菜单必须通过 portal 避开工具栏裁剪，在调整尺寸和滚动后仍位于可视区域，并以有界 DOM 更新定位，避免 React 渲染循环。键盘打开时聚焦首项；支持方向键、Home、End、Escape、Tab 和外部点击。Escape 关闭后恢复触发器焦点。

截图等待预期预览标题出现且不存在 `.preview-error`。稳定核心界面才使用 baseline；状态截图附在托管浏览器或视觉任务中。[截图目录](assets/screenshots/README.zh-CN.md)区分新鲜文档截图与储存的比较基线。

## 发布与恢复

所有安装包从准确审计标签构建。打包前验证工作机架构：Windows x86_64、macOS aarch64、Linux x86_64/aarch64。发布输入严格分为 `release-artifacts`中的七个安装包与 `release-evidence`中的四个 `signing-evidence-<platform>-<architecture>.json`记录。

官方记录声明 `signed: false`、`notarized: false`、`signatureType: "none"`。收据生成前运行 `node scripts/release/verify-signing-evidence.mjs release-evidence production`。`SHA256SUMS`只覆盖七个安装包；收据 schema 4 内嵌四份规范化信任记录。`node scripts/release/verify-release-evidence.mjs release-artifacts release-evidence`拒绝源漂移、脏 checkout、缺失/额外产物、不安全路径、符号链接、checksum/SBOM 不一致及不完整目标身份。

逐包验证 GitHub 来源、SBOM 证明与不可变标签沿革。发布说明解释未知发布者并提供单包校验及证明命令。记录干净安装和系统警告。损坏备份必须拒绝，在所有系统验证恢复；中断恢复/MCP 修改后必须确定性恢复。还需扫描、内存、索引、搜索、图、编辑器和导出性能门禁。

## 发布不变量与规范历史

手动调度默认为预览；发布需要现有 `v*`标签及 `publish: true`。**Release Kickoff**先验证准确提交的成功 CI，要求准确 `VERSION`，仅创建未使用的不可变标签并明确调度 Release。版本变化本身不创建标签；指向不同提交的已有标签必须失败，永不移动。

自动生产发布须等待标签构建与质量检查成功。Pages 仍受 `github-pages`环境保护。更新清单属于不可变版本；没有滚动标签或强制推送。**Release**是唯一 GitHub Release 所有者。含架构文件名防止碰撞。上传排除解包内部文件和 CI 证据；安装包校验与信任元数据分开验证。

在完整规范克隆中运行：

```bash
bash scripts/governance/history-audit.sh . .history-audit
```

还需经授权的全历史秘密扫描及托管平台的分支保护、审阅、环境保护、标签和发布沿革证据。源码契约通过不能证明公开发布。完成证明必须包含准确当前提交的 CI 矩阵和 **Visual review**，再接生产标签流程与公开产物。草稿 PR 暂缓重型门禁；`ready_for_review`触发完整矩阵。
