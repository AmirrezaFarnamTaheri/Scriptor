# 发布信任状态与下游签名

[English](SIGNING.md) · **简体中文** · [Русский](SIGNING.ru.md) · [Deutsch](SIGNING.de.md) · [Español](SIGNING.es.md) · [فارسی](SIGNING.fa.md)

Scriptor 将上游发布完整性与操作系统层面的发布者签名明确区分开来。

## 上游策略

官方 GitHub Releases 有意保持**未签名**：

- 不要求 Windows 证书；
- 不要求 Apple Developer ID 或公证凭据；
- 不要求 Linux OpenPGP 私钥；
- 发布工作流不会读取任何签名密钥；
- 预览版和生产版使用相同、明确的未签名策略；
- 生产发布仍必须具备完整的 checksum、SBOM、发布收据、源码身份、精确 subject 以及 GitHub attestation 证据。

这避免了过去的矛盾：表面上支持创建发布，但只要仓库缺少签名 secret，每个生产任务都会在编译前停止。

## 目标状态证据

每次构建使用 schema 2 写入 `signing-evidence-<platform>-<architecture>.json`。记录包含：

- 平台与架构；
- preview 或 production 渠道；
- `signed`、`notarized` 与 `signatureType` 的值；
- 验证说明；
- 精确的源码 commit；
- 创建时间戳。

官方工作流写入 `signed: false`、`notarized: false` 和 `signatureType: "none"`。发布验证器要求完整的目标矩阵：

- Windows `x86_64`；
- macOS `aarch64`；
- Linux `x86_64`；
- Linux `aarch64`。

验证器会拒绝重复、目标缺失、意外目标、错误渠道以及源码 commit 不匹配。发布时，四份记录会移入 `release-evidence`；schema 4 的 release receipt 会嵌入同一组规范化记录，并逐字节验证其与该元数据一致。信任记录本身不是安装包 checksum 或 attestation 的 subject。

## 操作系统行为

由于上游安装包未签名：

- Windows SmartScreen 可能报告“未知发布者”；
- macOS Gatekeeper 可能要求用户通过“系统设置”或 Finder 右键菜单确认打开应用；
- Linux 软件包依赖下载后的 checksum 与 GitHub attestation，而不是上游 OpenPGP 软件包签名。

发布说明必须醒目地说明这些限制。应用绝不能声称具有实际并不存在的 Authenticode 签名、Apple 公证或 OpenPGP 签名。

## 下游分发方签名

下游分发方可以用自己的证书或软件源流程对复制的安装包进行签名。这会产生不同的二进制字节，因此 checksum 和 attestation subject 也会与上游 GitHub Release 不同。

下游分发方必须：

1. 先验证上游 checksum 与 GitHub attestation；
2. 保留上游 release receipt 与源码 commit；
3. 只在自己受控的分发环境中签名；
4. 以自己的身份发布新的 checksum 和签名验证说明；
5. 绝不能替换官方 Scriptor release 中的上游资产。

证据 schema 可以为独立工具表示正确签名的 artifact，但官方上游 CI 不导入也不使用任何私有签名材料。

## 本地验证

验证无 secret 策略和目标矩阵：

```bash
node scripts/release/validate-signing-policy.mjs \
  --platform linux \
  --architecture x86_64 \
  --channel production
node --test scripts/release/signing-policy.test.mjs
```

写入一份本地未签名状态记录：

```bash
node scripts/release/write-signing-evidence.mjs \
  --platform linux \
  --architecture x86_64 \
  --channel production \
  --signed false \
  --notarized false \
  --signature-type none \
  --verifier "unsigned artifact; verify SHA-256 and GitHub attestation"
```

即使发布者签名不是前置条件，release verifier 对完整性和完备性仍保持 fail-closed。
