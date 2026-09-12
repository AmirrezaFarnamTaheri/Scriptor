# 参与贡献

[English](CONTRIBUTING.md) · [فارسی](CONTRIBUTING.fa.md) · **简体中文** · [Русский](CONTRIBUTING.ru.md) · [Deutsch](CONTRIBUTING.de.md) · [Español](CONTRIBUTING.es.md)

## 修改代码之前

1. 阅读 [`PRODUCT.zh-CN.md`](PRODUCT.zh-CN.md)、[`DESIGN.zh-CN.md`](DESIGN.zh-CN.md)、[`docs/ARCHITECTURE.zh-CN.md`](docs/ARCHITECTURE.zh-CN.md) 和 [`docs/CAPABILITY-MATURITY.zh-CN.md`](docs/CAPABILITY-MATURITY.zh-CN.md)。
2. 贡献者 onboarding、目录地图和入口点请参阅 [`docs/ONBOARDING.zh-CN.md`](docs/ONBOARDING.zh-CN.md)。
3. 对于 TypeScript packages，请阅读 [`packages/README.md`](packages/README.md)；只能通过已声明的 entry point 导入 package。
4. 保留与当前工作无关的 staged、unstaged 和 untracked 更改。

## 工具链

本地 gate 使用 Node.js 22.12 或更高版本（CI 固定为 22.16.0）、pnpm 10.33.0、Rust 1.96.0 和 PowerShell 7（`pwsh`）。浏览器无障碍检查还需要与已安装 Chrome 版本匹配的 ChromeDriver；如果无法自动发现，请设置 `CHROMEWEBDRIVER`。

```powershell
corepack enable
corepack prepare pnpm@10.33.0 --activate
pnpm install --frozen-lockfile
rustup toolchain install 1.96.0 --profile minimal --component rustfmt --component clippy
rustup default 1.96.0
pwsh --version
```

## 开发

```powershell
pnpm web:dev
pnpm desktop:dev
```

## 变更流程

- 修复 bug 之前，先用一个会失败的测试复现问题。
- 让 mutation、重构、依赖更新以及生成文件的更改保持可审查。当 PR 修改某个依赖的 major 或 minor 版本时，应在同一 commit 中根据固定的 upstream release notes 审计 call site：如果模块或方法被重命名（例如 `fs4` 1.x 将 `fs_std::FileExt::lock_exclusive` 移至 `FileExt::lock`），代码在任何平台都无法编译，而且这个错误会遮蔽后续所有 gate。
- 外部命令必须通过 `crates/system-bridge/src/process.rs`。
- Runtime JSON 必须从 `unknown` 开始验证；不要在边界处添加未经检查的 assertions。
- 每个新的 native command 都必须加入授权分类。
- 对长期存在或受用户控制的数据使用有界 queue/collection/output。
- 先更新 source-of-truth 文件，再重新生成派生契约。
- 当成熟度或支持状态变化时，同步更新文档和 capability ledger。

## 必需检查

```powershell
pnpm version:check
pnpm lint:actions
pnpm lint:boundaries
pnpm check:i18n
pnpm check:docs
pnpm check:source
pnpm check:frontend-quality
pnpm lint
pnpm build
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
pnpm test:rust
```

`pnpm test:rust` 对应 CI 的 Rust gate：它从产品测试运行中排除 `scriptor-desktop`（由 `desktop-check.yml` 覆盖）以及处于孵化阶段的 engines（`scriptor-embeddings`、`scriptor-tantivy-indexer`、`scriptor-wasm-runtime`），然后通过 `test:rust:engines` 单独测试这些 engines。`scriptor-citation-engine` 仍位于产品测试图中，因为其 BibLaTeX parser 是 indexer 的受支持依赖；该 crate 只有 citeproc/rendering 部分仍处于孵化阶段。

针对变更的行为运行相应 package validator 和 Playwright suite。UI 变更必须包含键盘、screen-reader 语义、loading/empty/error 状态、窄 viewport 以及 200% 缩放的证据。

`pnpm check:release` 是广泛的 release gate，并不是最快的本地反馈循环。先运行上面的针对性检查，然后在安装了 desktop/browser 前置条件的机器上运行完整 gate。

证据术语以及平台/release gate 定义在 [`docs/VERIFICATION.zh-CN.md`](docs/VERIFICATION.zh-CN.md) 中。绝不能把静态源代码检查描述为已编译、已打包、native 验证或 browser 验证结果。

## Pull request

请描述：

- 可观察到的行为变化；
- 受影响的权限/数据边界；
- 已运行的测试和命令及其结果；
- migration/rollback 行为；
- 面向用户的可见更改截图；
- 未验证平台或剩余风险。

不要提交 secret、生成的 build 目录、debug log 或个人 vault 数据。

## 许可

除非另有说明，贡献采用 **AGPL-3.0-or-later** 许可。提交贡献即表示您有权按这些条款授予许可。有关单独许可政策，请参阅 [`COMMERCIAL-LICENSING.zh-CN.md`](COMMERCIAL-LICENSING.zh-CN.md)。

## 安全

请按照 [`SECURITY.zh-CN.md`](SECURITY.zh-CN.md) 私下报告漏洞。
