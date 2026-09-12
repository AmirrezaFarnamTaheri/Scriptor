[English](VERIFICATION.md) · [فارسی](VERIFICATION.fa.md) · **简体中文** · [Русский](VERIFICATION.ru.md) · [Deutsch](VERIFICATION.de.md) · [Español](VERIFICATION.es.md)

# 验证证据

**日期：**2026-08-23（仓库本地证据；并不声称本次会话重新执行了下列每一条命令）

本文描述仓库中用于 hygiene、契约、安全、build、测试、packaging 与 release provenance 的证据链。已经记录的命令、文件名、标识符、hash 和工具输出属于技术证据，因此保持原样，不作为产品文案翻译。

## 1. 本地 Hygiene、发现与范围审查

解释测试结果之前，首先确认哪个 commit 与哪些来源才是权威状态。需要排除 working-tree drift、意外生成文件、过期本地产物，以及与实现冲突的文档。

常用仓库原生检查：

```powershell
git status --short
git rev-parse HEAD
git ls-files
pnpm version:check
pnpm check:source
pnpm check:docs
pnpm check:i18n
```

本阶段还会检查 `package.json`、`pnpm-lock.yaml`、`Cargo.toml`、`Cargo.lock`、`rust-toolchain.toml`、Tauri 配置、`.github/workflows/` 下的 workflow、release scripts，以及架构/能力成熟度文档。精确 commit 上的实现才是 source of truth；历史审计或计划文档不能替代当前状态检查。

**接受规则：**只有证据与同一 source commit 绑定，或其 provenance contract 明确证明经过验证的派生关系时，才能将该证据归属于某个 release candidate。

## 2. 安全与依赖 Gate

Dependency/security 审查覆盖 Node/pnpm、Rust/Cargo、GitHub Actions 与外部工具。仓库原生 gate 会检查 workflow pinning、依赖策略、进程启动 inventory 与已知 advisories。

```powershell
pnpm lint:actions
pnpm check:release-security
cargo deny check
cargo tree --workspace
```

RustSec exception 不被视为通用 suppression。唯一允许的 exception surface 是版本控制的 [`security/RUSTSEC-EXCEPTIONS.zh-CN.md`](security/RUSTSEC-EXCEPTIONS.zh-CN.md)，其中记录 owner、reachability、复审日期和退出条件。新出现或可升级修复的 vulnerability-class advisory 仍然是 release blocker。

Process boundary 也是安全 gate 的组成部分：production 外部程序启动必须经过批准的 system bridge，并与 process inventory 对照。Secrets、network、filesystem、MCP mutation 与 plugin permission 都必须在其原生 trust boundary 上 fail-closed 验证。

## 3. 类型、契约与边界 Surface

Scriptor 使用生成的 Rust/TypeScript contract 和额外 source contract，防止 renderer、Tauri、daemon、CLI/TUI 与 MCP 的 payload 悄然分叉。

```powershell
pnpm check:contracts
pnpm check:generated-contracts
pnpm lint:boundaries
pnpm check:source
pnpm check:frontend-quality
pnpm check:i18n
```

Command surface 记录在 [`contracts/COMMAND_CATALOG.zh-CN.md`](contracts/COMMAND_CATALOG.zh-CN.md)。Boundary outcome 遵循 [`contracts/BOUNDARY_OUTCOMES.zh-CN.md`](contracts/BOUNDARY_OUTCOMES.zh-CN.md)：`value`、`absent-optional`、`invalid`、`degraded`、`failed`、`recovered` 不得折叠为单一 default value。

**接受规则：**新增 command、RPC、MCP tool 或 CLI entry point 必须具有 owner、permission class、typed input/output、failure semantics、audit behavior，以及 rollback/no-mutation contract。

## 4. Build 与 UI Smoke

Frontend 与 desktop build 用于验证 TypeScript/React surface、Tauri host 和 bundled assets 彼此兼容。

```powershell
pnpm install --frozen-lockfile
pnpm lint
pnpm build
cargo check --workspace
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
```

Desktop-specific release evidence 必须在受支持操作系统上执行 Tauri build path。Web build 通过并不能单独证明 desktop integration、native capability 或 installer 生成正确。

UI smoke 至少覆盖打开 vault、读写笔记、index/search readiness、error/recovery state 与主导航。E2E/screenshot mode 不得泄漏到 production bundle。

## 5. 测试套件

验证组合快速 source contract、JavaScript/TypeScript tests、Rust tests、Playwright E2E、accessibility 与 visual regression。任何一种测试都不能替代其他测试类型。

```powershell
pnpm test:source
pnpm test:rust
pnpm test:e2e
pnpm test:visual
pnpm test:a11y
pnpm check:release
```

`pnpm check:release` 是聚合 release gate，会运行 candidate 所需的 contract runner、Rust checks、Playwright suites、accessibility audit、daemon/TUI smoke 与 performance gate。

### E2E 与 Visual

Playwright 为功能 E2E 与稳定 visual suite 使用独立 config/output directory。权威文档 screenshot 是当前 source 的新鲜 capture；稳定 Windows snapshot 是独立 visual-regression acceptance surface。参见 [`assets/screenshots/README.zh-CN.md`](assets/screenshots/README.zh-CN.md) 与 [`VISUAL-REVIEW.zh-CN.md`](VISUAL-REVIEW.zh-CN.md)。

刻意的 pixel change 必须审查并明确更新。绝不能通过提高全局 visual tolerance 来掩盖 regression。

### Accessibility

Accessibility evidence 结合自动 axe 检查与 modal、menu、Canvas/Graph、virtualized list、security-state control 的 keyboard/focus contract。产品 surface 的最低目标为 WCAG 2.2 AA；coarse-pointer target 不小于 44×44 px。

### Performance

Benchmark 具有 versioned baseline 与明确 threshold。Performance gate 用于发现启动、indexing、search、graph、大型 vault 和高内存 surface 的回归，并不用于在任意硬件之间做绝对性能比较。

## 6. Packaging 与 Installer 验证

只有全部平台成功 packaging 后，release 才算 desktop release。支持矩阵对应 README/release 文档声明的 Windows、macOS 与 Linux。

Packaging evidence 尤其检查：

- 预期文件类型和架构；
- `VERSION`、npm、Cargo 与 Tauri 的版本一致性；
- release bundle 不含 E2E/fault-injection marker；
- installer/bundle 名称和 checksums；
- 不存在意外 symbolic link、absolute/traversal path；
- 能可重复地关联到 release commit。

相关入口记录在 `scripts/release/`；release workflow 生成各平台 artifact，随后在统一 evidence stage 中收集。

## 7. Release Evidence、SBOM 与 Provenance

Release pipeline 在下载全部平台 artifact **之后**生成最终证据。权威文件包括：

```text
release-receipt.json
scriptor.cyclonedx.json
SHA256SUMS
```

Verifier 将 receipt 视为精确 allowlist。缺失 artifact、额外未入 receipt 的 artifact、重复 checksum、symbolic link、absolute/traversal path、source-tree drift 或 SBOM metadata drift 都会阻止 promotion。参见 [`evidence/README.zh-CN.md`](evidence/README.zh-CN.md) 与 [`RELEASE-SECURITY.zh-CN.md`](RELEASE-SECURITY.zh-CN.md)。

GitHub provenance attestation 与记录的 source identity 只会在本地 evidence 成功验证后生成。没有权威 Git checkout 的本地 archive 可用于诊断，但不能作为 production provenance 接受。

## 视觉验证与文档产物

仓库中的 screenshot 是文档 artifact，本身不能证明 release。可靠 visual evidence 必须记录精确 commit、OS/runner、browser/channel、viewport 或 device scale，以及对应 Playwright suite 的结果。

Screenshot gallery、capture 规则与 reviewer discipline 记录在 [`assets/screenshots/README.zh-CN.md`](assets/screenshots/README.zh-CN.md) 与 [`VISUAL-REVIEW.zh-CN.md`](VISUAL-REVIEW.zh-CN.md)。

## 仓库证据的已知边界

- 本文记录 repository-local evidence；上方日期并不意味着之后每次会话都重新运行了所有命令。
- 单个 green job 不能替代 commit-exact release gate chain。
- 本地或历史 CI log 不能归属于另一个 commit。
- 与平台相关的 packaging/signing/installer evidence 必须在对应支持平台或指定 workflow 中产生。
- 即使存在测试，design-only 或 experimental capability 也不会自动变成受支持 production feature；能力成熟度 ledger 仍是权威。

## Release 解释规则

Production 发布要求当前 gate 在精确 release commit 上全部通过，并且生成 artifact 可证明引用同一 commit。当历史 evidence 与当前实现冲突时，以当前可重复实现和 commit-bound verification 为准。
