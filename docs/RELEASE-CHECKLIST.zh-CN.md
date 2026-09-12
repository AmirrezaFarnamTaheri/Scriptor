# Production Release 检查清单

[English](RELEASE-CHECKLIST.md) · **简体中文** · [Русский](RELEASE-CHECKLIST.ru.md) · [Deutsch](RELEASE-CHECKLIST.de.md) · [Español](RELEASE-CHECKLIST.es.md) · [فارسی](RELEASE-CHECKLIST.fa.md)

批准 release 前必须审查 visual capture baseline。标准截图图库位于主 [`README.md`](../README.md)，完整的 reviewed capture 清单、review note 与再生成流程在 [`assets/screenshots/README.md`](assets/screenshots/README.md)，review discipline 与 suite coverage 在 [`VISUAL-REVIEW.md`](VISUAL-REVIEW.md)。

Production release 在所有必需项都针对精确 tag 与精确 artifact bytes 核对完成前必须保持 blocked。

## Promotion 停止条件

- [ ] 任一必需项 pending、failed、skipped，或证据来自不同 source tree 时停止；
- [ ] installer subject set 与 receipt 哪怕只差一个文件也停止；
- [ ] target 缺失、重复、意外新增或标签错误时停止；
- [ ] initial editor chunk 进入 eager bundle graph 或 gzip budget 回退时停止；
- [ ] destructive action 的 cancel/failure 使 disk、tab、index 或 vault state 分叉时停止；
- [ ] process launch 没有 live per-call inventory entry 或 review 已过期时停止；
- [ ] target platform 上无法证明 rollback、restore、trust status 或 observability 时停止；
- [ ] RustSec exception review 过期或无 owner/exit condition 时停止；
- [ ] exact-head CI matrix 中 Playwright E2E 或 visual regression 被跳过/缺失时停止；
- [ ] repository protected release environment 缺失、没有 required reviewer，或未 gate production publish job 时停止；
- [ ] 发布的 vault 内容需要 review，但 GitHub Pages deployment 没有单独批准的 `github-pages` environment 时停止。

## Source freeze

- [ ] canonical working tree clean；
- [ ] npm、Cargo、Tauri 与 lockfile metadata 同步且匹配 `VERSION`；
- [ ] reviewed `v<version>` tag 与 `VERSION` 及精确 release commit 一致；
- [ ] 绝不移动或复用已有 version tag；
- [ ] `pnpm check:governance` 通过；
- [ ] `pnpm check:source` 通过；
- [ ] validation 不改变 lockfile；
- [ ] full history/secret/provenance audit 已与 tag 对齐；
- [ ] non-publishing `Release Binary Review` workflow 对精确 candidate 通过并保留 CLI/daemon binary manifest。

## Engineering verification

- [ ] frozen pnpm install 成功；
- [ ] lint、TypeScript build、package contract runner、unit/integration tests 全部通过；
- [ ] product 与 incubating profile 的 Cargo fmt、Clippy、tests、cargo-deny 通过；
- [ ] daemon、CLI/TUI、container、E2E、visual、axe、performance gates 通过；
- [ ] 不静默接受 skipped/flaky test。

## Security 与 data integrity

- [ ] 每个新 native command 都已分类并进入 authorization inventory；
- [ ] 没有新增 remote fallback、generic secret API、shell string、unbounded queue/log/output 或 unchecked boundary assertion；
- [ ] release workflow 不依赖 certificate、notarization、private key、signing secret；
- [ ] 官方 release note 明确披露 installer 未签名；
- [ ] backup creation、corruption rejection、interrupted restore、successful restore 均已演练；
- [ ] MCP interrupted-mutation reconciliation 与 audit integrity 已演练；
- [ ] privacy 与 diagnostic output 已 redacted 且 bounded。

## UI quality

- [ ] 所有必需 breakpoint/theme 的截图已重建并 review；
- [ ] 无 console error 或 failed network resource；
- [ ] keyboard/focus order 通过，包括所有 modal、composite tab control、toolbar popover；
- [ ] Typography/Insert menu 通过 body portal 渲染在 scroll-clipping ancestor 外，保持 viewport 内，支持 Escape/Tab/outside click 关闭，并在 Escape 后恢复 focus；
- [ ] toolbar popover positioning 不触发额外 React render loop；
- [ ] axe 无 critical/serious violation；
- [ ] screen reader、200% zoom、reduced motion、high contrast spot check 通过；
- [ ] empty/loading/error/success/destructive state 已视觉 review。

## Artifact production

- [ ] 只从 frozen tag build 一次；
- [ ] Windows x86_64 恰好产出 1 MSI + 1 NSIS EXE；
- [ ] macOS aarch64 恰好产出 1 DMG；
- [ ] Linux x86_64 恰好产出 1 DEB + 1 AppImage；
- [ ] Linux aarch64 恰好产出 1 DEB + 1 AppImage；
- [ ] 每个 target 写一份 `signing-evidence-<platform>-<architecture>.json`；
- [ ] 官方记录为 `signed: false`、`notarized: false`、`signatureType: "none"`；
- [ ] artifact name 包含 version/platform/architecture 且不会 collision；
- [ ] 每个 transport artifact 只含 installer 与 target-status record；
- [ ] publication 把恰好 7 个 installer 放入 `release-artifacts`、恰好 4 个 trust record 放入 `release-evidence`；
- [ ] 不含 unpacked AppDir、`.app` internals、DMG helper script、log、cache、source map、development file；
- [ ] 每个支持 target clean install + smoke test 通过。

## Provenance 与 publication

- [ ] primary `Release` workflow 是唯一 GitHub Release owner；
- [ ] preview dispatch 不发布；
- [ ] production dispatch 绑定已有 immutable `v*` tag；
- [ ] 仅针对 7 个 installer subject 生成 `SHA256SUMS`；
- [ ] 生成绑定 release source identity 的 CycloneDX 1.6 SBOM；
- [ ] 生成 release receipt schema 4，包含 installer hash + 4 个 architecture-bound trust record；
- [ ] upload 前验证 receipt、checksum、SBOM、source identity、trust metadata 与 exact installer membership；
- [ ] 为每个 installer subject 生成 GitHub provenance 与 SBOM attestations；
- [ ] 不 rebuild，发布精确下载的 installer 与生成 evidence；
- [ ] 根据 published assets 验证 `RELEASE-SECURITY.md` 的单 installer consumer instructions；
- [ ] release notes 包含 unknown-publisher guidance 与 checksum/attestation commands；
- [ ] 更新 changelog、capability ledger、support window 与 known limitations。
