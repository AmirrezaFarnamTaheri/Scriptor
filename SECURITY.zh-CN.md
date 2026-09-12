# 安全策略

## 报告漏洞

如果怀疑存在漏洞，请不要创建公开 issue。请发送邮件至 **taherifarnam@gmail.com**，并包含：

- 受影响的版本/commit；
- 环境和前置条件；
- 可复现步骤或 proof of concept；
- 影响以及被跨越的数据/权限边界；
- 建议的 embargo 或协调需求。

不要包含真实 secret 或第三方个人数据。我们会在实际可行的最短时间内确认收到报告；在影响与 remediation 得到充分理解后，再协调 disclosure 时间。

## 支持的版本

只有当前 tagged release 和当前 `main` 分支会获得安全修复。Release 身份由 [`VERSION`](VERSION) 确定。

## 信任边界

- **Renderer：** 相对于 native filesystem、keychain、process、backup、Git、network 和 publish 权限，被视为不可信。
- **Tauri commands：** 按操作分类；敏感 command 需要在 native 用户确认后新签发的一次性 scoped grant。
- **Daemon/IPC：** same-user 本地 endpoint；endpoint metadata 由 HMAC 保护；每个 request 和 event subscription 都必须携带每 endpoint nonce；消息 typed/versioned；frame/queue 有界；支持自动 authenticated resubscription；event stream 中断后会显式进行 state resynchronization。Windows 上，本地 TCP/named pipe endpoint 的安全依赖 HMAC-SHA256 bearer token authentication，token 存放在用户范围 `%LOCALAPPDATA%`（或 OS Credential Manager）中，而不是依赖 Unix socket 文件系统权限。
- **MCP：** 明确的 tools、持久 intent/outcome audit record、idempotency key、有界日志，以及 pending intent 恢复。
- **External tools/code chunks：** 通过 process broker 启动，并执行 executable resolution、environment sanitization、network policy、time/output bounds、process-tree cancellation 和 receipt 记录。
- **Plugins：** 当前 runtime 是 restricted/manifest-first；permission consent、签名的第三方分发和隔离执行仍是升级要求。
- **AI providers：** credentials 保留在 native keychain boundary；network call 由 Rust 通过经过验证的 endpoint 发出，不向 JavaScript 暴露原始 secret。

## 数据与隐私

Scriptor 是 local-first 产品，不要求 telemetry。Diagnostics 为 opt-in，并且只应包含 allowlist、已脱敏字段。Remote PlantUML 和远程字体已禁用。任何可选远程 integration 都必须明确说明 endpoint 以及发送的数据。

## 加密状态

`crates/vault/src/encryption.rs` 包含 versioned cryptographic primitives 与测试。**Encrypted vault 仍是实验性功能，不属于受支持的端到端安全能力。** Index、backup、Git history、临时文件、metadata leakage、key recovery 和 migration 都不能仅靠单文件加密原语解决。参见 [`docs/ENCRYPTION-THREAT-MODEL.zh-CN.md`](docs/ENCRYPTION-THREAT-MODEL.zh-CN.md)。

## 发布完整性

官方 upstream production installer 有意保持 unsigned，其 trust record 明确记录 platform signing 与 notarization 均不存在。Production 发布改为要求每个 target 都有明确 trust-status record、SHA-256 checksum、CycloneDX SBOM、不可变 release receipt、精确 source identity 以及 GitHub provenance attestation。验证说明见 [`docs/RELEASE-SECURITY.zh-CN.md`](docs/RELEASE-SECURITY.zh-CN.md)。
Production go/no-go 流程见 [`docs/RELEASE-CHECKLIST.zh-CN.md`](docs/RELEASE-CHECKLIST.zh-CN.md)；当前 evidence 术语以及尚未验证的部分记录于 [`docs/VERIFICATION.zh-CN.md`](docs/VERIFICATION.zh-CN.md)。

## 依赖与 CI 策略

- lockfile 是 validation 输入，audit job 不得修改它们；
- 外部 GitHub Actions 必须固定到已审查的完整 immutable commit SHA，并标注精确版本；
- Node、pnpm、Rust、runner 与 release 工具全部 pin 版本；
- CI 运行 `cargo deny`、`pnpm audit --prod`、action pin、version、boundary、docs 和 source-contract gates；
- dependency update 必须在独立、经过 review 的变更中完成。
