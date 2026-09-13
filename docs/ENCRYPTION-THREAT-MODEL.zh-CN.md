<div dir="ltr" align="center">
[English](ENCRYPTION-THREAT-MODEL.md) · [فارسی](ENCRYPTION-THREAT-MODEL.fa.md) · **简体中文** · [Русский](ENCRYPTION-THREAT-MODEL.ru.md) · [Deutsch](ENCRYPTION-THREAT-MODEL.de.md) · [Español](ENCRYPTION-THREAT-MODEL.es.md)
</div>

# 加密 Vault 威胁模型

**结论：** 加密功能仍处于实验阶段。拥有密码学原语并不等同于拥有端到端完整的加密 vault 产品。

## 资产

Markdown 内容、附件、配置、索引、搜索词、图谱/链接元数据、Git 历史、备份、临时导出、日志、进程参数、密钥以及恢复材料。

## 范围内威胁

- 丢失或被盗且处于关机状态的设备；
- vault 或备份的离线副本；
- migration/export/restore 过程中意外残留的明文；
- 弱口令与参数降级；
- 密钥丢失，以及中断的 rekey/migration；
- 通过路径、索引、Git、日志、缩略图、swap 或 crash dump 泄露元数据。

## 单文件加密无法解决的威胁

已被攻陷的运行中操作系统/用户会话、已经获得权限的恶意 renderer、键盘记录器、恶意外部工具、内存中正在显示的明文，或能够访问已解锁 keychain/会话材料的攻击者。

## 升级为受支持能力前所需的架构

1. 带版本的 envelope，其中包含算法/KDF 标识与参数；
2. OS keychain 与口令恢复设计，并明确说明丢失语义；
3. 对 index/graph/cache 进行加密或明确排除的策略；
4. 支持 rollback 的原子 migration/rekey journal；
5. 加密的外部备份以及 restore 演练；
6. 防止明文进入历史记录的 Git 策略；
7. 安全的临时文件/export 处理；
8. 独立密码学审查、known-answer tests、fuzzing、fault injection 与参数迁移测试；
9. 能准确表达 locked/unlocked 状态及元数据泄露范围的 UI。

## 当前实现

`crates/vault/src/encryption.rs` 使用 authenticated encryption，并通过 Argon2id 进行口令派生，同时包含版本检查和负向测试。它目前只是一个原型库模块，并未作为透明、受支持的 vault 模式接入产品。产品和安全文档必须始终保留这一差别。
