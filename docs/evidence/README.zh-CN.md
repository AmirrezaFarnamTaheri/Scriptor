[English](README.md) · [فارسی](README.fa.md) · **简体中文** · [Русский](README.ru.md) · [Deutsch](README.de.md) · [Español](README.es.md)

# 证据策略

发布证据从干净、权威的 Git checkout 生成，并同时绑定到检出的 commit 与确定性的 SHA-256 源码树标识。`release-receipt.json`、`scriptor.cyclonedx.json` 和 `SHA256SUMS` 会在所有平台产物下载完成后由 publish job 创建，并在 attestation 或上传前验证。

本地 `artifacts/`、`ci-logs/`、`job_log.txt` 和 `ci.log` 路径属于临时数据并被忽略。历史失败 CI 输出可以存放在源码树之外用于诊断，但绝不会被接受为另一个 commit 或 release candidate 的证据。

Verifier 将 receipt 视为精确 allowlist。缺少产物、额外未入 receipt 的产物、符号链接、路径穿越/绝对路径、重复 checksum 条目、source-tree drift 或 SBOM metadata drift 都会阻止 promotion。证据生成与验证要求干净的权威 Git checkout；archive mode 仅用于诊断 source-identity 报告，不被 promotion verifier 接受。
