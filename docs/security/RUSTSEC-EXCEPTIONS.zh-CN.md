[English](RUSTSEC-EXCEPTIONS.md) · [فارسی](RUSTSEC-EXCEPTIONS.fa.md) · **简体中文** · [Русский](RUSTSEC-EXCEPTIONS.ru.md) · [Deutsch](RUSTSEC-EXCEPTIONS.de.md) · [Español](RUSTSEC-EXCEPTIONS.es.md)

# RustSec Advisory 例外台账

本台账负责记录 `cargo-deny` 暂时忽略的每一条 advisory。Ignore 并不等于否定风险：它记录经过审查且实际可达的依赖约束，并指定负责人、复审日期和明确退出条件。可升级修复的漏洞仍由 CI 拒绝。

**负责人：**Scriptor release/security 维护者  
**复审频率：**每月以及每个 production tag 之前  
**上次完整复审：**2026-09-03  
**下次完整复审：**2026-10-01

### 2026-09-03 复审证据

- GTK3/Tauri、`proc-macro-error`、`atomic-polyfill`、`paste`、`rust-unic` 的忽略项仍属于 RustSec **INFO / unmaintained**，没有修复版本。锁定包仍存在，因为当前 checkout 支持的 Tauri/Linux 或传递产品依赖图没有兼容且受维护的替代方案。
- `RUSTSEC-2025-0057` (`fxhash`) 已从本台账和 `deny.toml` 删除：`Cargo.lock` 已无 `fxhash`；继续保留例外只会掩盖未来重新引入，而不是记录当前可达性。
- 本次复审不会屏蔽新发布漏洞。对这份精确列表之外的 advisory，`cargo deny` 仍是 production 权威；下一次具备生产发布能力的环境必须在 tagging 前基于当前 advisory 数据库运行它。

### 2026-09-05 集成审计跟进

新拉取的 RustSec 数据库没有发现 vulnerability-class advisory，但发现 18 个 unmaintained package，以及 `glib` 和两个 `lru` 版本的 informational unsoundness advisory。TUI dependency 已从 `lru` 0.18.1 升级到修复后的 0.18.2。Tantivy 0.26.1 仍解析到 `lru` 0.16.4，在兼容 release 范围内没有替代。Linux Tauri stack 仍解析到受 RUSTSEC-2024-0429 影响的 `glib` 0.18.5。这两个 unsoundness finding **不会**加入 ignore list；它们仍是 upstream dependency 工作，并必须在 production release 前评估。本次审计禁用了 yanked-version 查询，因此不能证明 lockfile 不含 yanked release。

| Advisory | Dependency family | 可达性 | Owner | Upstream | 复审日期 | 退出条件 |
|---|---|---|---|---|---|---|
| RUSTSEC-2024-0370 | GTK/Tauri Linux desktop stack | Linux desktop packaging/runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0370.html | 2026-10-01 | Tauri/WebKitGTK 不再解析受影响 unmaintained crate 时删除 |
| RUSTSEC-2024-0411 | GTK/Tauri Linux desktop stack | Linux desktop packaging/runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0411.html | 2026-10-01 | 支持的 Tauri Linux stack 有受维护替代方案时删除 |
| RUSTSEC-2024-0412 | GTK/Tauri Linux desktop stack | Linux desktop packaging/runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0412.html | 2026-10-01 | 支持的 Tauri Linux stack 有受维护替代方案时删除 |
| RUSTSEC-2024-0413 | GTK/Tauri Linux desktop stack | Linux desktop packaging/runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0413.html | 2026-10-01 | 支持的 Tauri Linux stack 有受维护替代方案时删除 |
| RUSTSEC-2024-0414 | GTK/Tauri Linux desktop stack | Linux desktop packaging/runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0414.html | 2026-10-01 | 支持的 Tauri Linux stack 有受维护替代方案时删除 |
| RUSTSEC-2024-0415 | GTK/Tauri Linux desktop stack | Linux desktop packaging/runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0415.html | 2026-10-01 | 支持的 Tauri Linux stack 有受维护替代方案时删除 |
| RUSTSEC-2024-0416 | GTK/Tauri Linux desktop stack | Linux desktop packaging/runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0416.html | 2026-10-01 | 支持的 Tauri Linux stack 有受维护替代方案时删除 |
| RUSTSEC-2024-0417 | GTK/Tauri Linux desktop stack | Linux desktop packaging/runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0417.html | 2026-10-01 | 支持的 Tauri Linux stack 有受维护替代方案时删除 |
| RUSTSEC-2024-0418 | GTK/Tauri Linux desktop stack | Linux desktop packaging/runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0418.html | 2026-10-01 | 支持的 Tauri Linux stack 有受维护替代方案时删除 |
| RUSTSEC-2024-0419 | GTK/Tauri Linux desktop stack | Linux desktop packaging/runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0419.html | 2026-10-01 | 支持的 Tauri Linux stack 有受维护替代方案时删除 |
| RUSTSEC-2024-0420 | GTK/Tauri Linux desktop stack | Linux desktop packaging/runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0420.html | 2026-10-01 | 支持的 Tauri Linux stack 有受维护替代方案时删除 |
| RUSTSEC-2023-0089 | Transitive product dependency | Product graph；未记录安全兼容升级 | Release/Security | https://rustsec.org/advisories/RUSTSEC-2023-0089.html | 2026-10-01 | 上游 parent 发布修复版本或替换 parent dependency 时删除 |
| RUSTSEC-2024-0436 | Transitive product dependency | Product graph；未记录安全兼容升级 | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0436.html | 2026-10-01 | 上游 parent 发布修复版本或替换 parent dependency 时删除 |
| RUSTSEC-2025-0075 | Tauri `urlpattern` 引入的 `rust-unic` | Desktop URL-pattern parsing | Release/Security | https://rustsec.org/advisories/RUSTSEC-2025-0075.html | 2026-10-01 | Tauri 替换 unmaintained `rust-unic` family 时删除 |
| RUSTSEC-2025-0080 | Tauri `urlpattern` 引入的 `rust-unic` | Desktop URL-pattern parsing | Release/Security | https://rustsec.org/advisories/RUSTSEC-2025-0080.html | 2026-10-01 | Tauri 替换 unmaintained `rust-unic` family 时删除 |
| RUSTSEC-2025-0081 | Tauri `urlpattern` 引入的 `rust-unic` | Desktop URL-pattern parsing | Release/Security | https://rustsec.org/advisories/RUSTSEC-2025-0081.html | 2026-10-01 | Tauri 替换 unmaintained `rust-unic` family 时删除 |
| RUSTSEC-2025-0098 | Tauri `urlpattern` 引入的 `rust-unic` | Desktop URL-pattern parsing | Release/Security | https://rustsec.org/advisories/RUSTSEC-2025-0098.html | 2026-10-01 | Tauri 替换 unmaintained `rust-unic` family 时删除 |
| RUSTSEC-2025-0100 | Tauri `urlpattern` 引入的 `rust-unic` | Desktop URL-pattern parsing | Release/Security | https://rustsec.org/advisories/RUSTSEC-2025-0100.html | 2026-10-01 | Tauri 替换 unmaintained `rust-unic` family 时删除 |

## 复审流程

1. 针对 locked graph 运行 `cargo deny check` 与 `cargo tree -i <crate>`。
2. 确认 advisory 是否仍只是 unmaintained，还是已经成为可利用 vulnerability。
3. 记录可达的 Scriptor surface，以及阻止删除的直接 parent。
4. 一旦存在兼容且受维护的迁移路径，立即删除 ignore。
5. 将错过 `Review by` 日期视为 production release blocker。
