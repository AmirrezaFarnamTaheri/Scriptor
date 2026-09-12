# 维护者

[English](MAINTAINERS.md) · [فارسی](MAINTAINERS.fa.md) · **简体中文** · [Русский](MAINTAINERS.ru.md) · [Deutsch](MAINTAINERS.de.md) · [Español](MAINTAINERS.es.md)

## 当前维护者

Amirreza “Farnam” Taheri  
邮箱：[taherifarnam@gmail.com](mailto:taherifarnam@gmail.com)  
GitHub：[@AmirrezaFarnamTaheri](https://github.com/AmirrezaFarnamTaheri)

## 所有权模型

上传的源码基线不包含规范 Git 历史，因此无法仅凭该工件证明历史所有权或 bus factor。仓库现已包含 [`.github/CODEOWNERS`](.github/CODEOWNERS)，但托管平台是否真正执行这些规则，以及实际 review 是否过度集中，仍必须在规范仓库中验证。项目应维护：

- 针对安全、release、Rust 内核、前端和文档路径的 `CODEOWNERS`；
- 对 release 以及安全敏感变更至少安排两名 reviewer；
- 每季度生成一次所有权、代码 churn 与 secret 历史报告；
- 使用不可变的 release tag 和受保护的 production environment。

在记录更多维护者之前，首席维护者是所有领域的升级负责人。这是连续性风险，并不意味着存在某种推断出的团队结构。

可从完整 clone 中生成本地历史证据：

```bash
bash scripts/governance/history-audit.sh . .history-audit
```

## Release 权限

Production release：

1. 必须源自与 [`VERSION`](VERSION) 一致的 `v<version>` tag；
2. 必须通过 `.github/workflows/ci.yml` 及各平台 compile/package gate；
3. 使用仓库记录的未签名安装包信任模型：精确源码身份、SHA-256 checksum、与 target 绑定的 trust-status 记录、SBOM、release receipt，以及 GitHub provenance attestation；
4. 发布阶段不得重新构建，只能提升实际下载到的那组 build 工件；
5. 必须发布 release evidence 合同要求的 checksum、SBOM、release receipt、trust metadata 与 attestation。

参见 [`docs/RELEASE-SECURITY.zh-CN.md`](docs/RELEASE-SECURITY.zh-CN.md)。

## 支持与升级

| 主题 | 渠道 |
|---|---|
| 安全 | 按 [`SECURITY.zh-CN.md`](SECURITY.zh-CN.md) 通过私人邮件报告 |
| Bug/功能 | GitHub Issues |
| 贡献 | [`CONTRIBUTING.zh-CN.md`](CONTRIBUTING.zh-CN.md) |
| 许可 | [`COMMERCIAL-LICENSING.zh-CN.md`](COMMERCIAL-LICENSING.zh-CN.md) |
| 能力状态 | [`docs/CAPABILITY-MATURITY.zh-CN.md`](docs/CAPABILITY-MATURITY.zh-CN.md) |
