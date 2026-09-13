[English](MOBILE_ARCHITECTURE.md) · [فارسی](MOBILE_ARCHITECTURE.fa.md) · **简体中文** · [Русский](MOBILE_ARCHITECTURE.ru.md) · [Deutsch](MOBILE_ARCHITECTURE.de.md) · [Español](MOBILE_ARCHITECTURE.es.md)

# 移动端架构

**成熟度：**仅设计 / 孵化中。  
**发布状态：**不属于受支持的 Scriptor 1.0 桌面产品。  
**权威来源：**[`PRODUCT.zh-CN.md`](../../PRODUCT.zh-CN.md) 与 [`CAPABILITY-MATURITY.zh-CN.md`](../CAPABILITY-MATURITY.zh-CN.md)。

## 目的

本文记录未来移动端工作的架构边界，并不暗示已经发布 Android 或 iOS 应用。Scriptor 当前受支持的产品仍是 Windows、macOS 与 Linux 上的 Tauri 桌面应用。移动端工作可以原型化可移植的领域逻辑和用户流程，但不得悄然扩大产品支持契约。

## 架构契约

未来移动客户端必须保持与桌面端相同的产品不变量：

1. **Markdown 是权威来源。** 笔记仍是普通文件；移动索引是派生数据，可以重建。
2. **可移植领域逻辑位于平台适配器之下。** Parsing、任务语义、链接解析、模板、merge logic 等确定性策略在 API 平台中立时应进入共享 packages/crates。
3. **原生能力通过明确适配器提供。** 文件选择、后台工作、通知、安全存储、share sheet 与平台 lifecycle 必须隐藏在移动端专用边界之后。
4. **没有隐藏的云依赖。** 未来同步功能是可选的，并单独进行 threat model；移动端默认不改变 local-first 权威模型。
5. **信任边界保持 fail-closed。** 外部 intents、导入文件、plugin/tool 执行和未来远程同步都要求明确验证与有界资源使用。
6. **行为一致性由契约证明，而不是复制 UI。** 共享 fixtures 与生成 contracts 应证明桌面和移动端之间的 note/task/link 语义。

## 建议拓扑

```text
mobile UI / navigation
        |
        v
mobile application adapter
        |
        +--> shared TypeScript domain packages
        |
        +--> native mobile capability adapters
                 |-- filesystem / document provider
                 |-- secure settings / credentials
                 |-- notifications / background scheduling
                 `-- optional sync transport (future, separately governed)
```

因此现有 `apps/mobile/` 内容在存在时属于探索性质。桌面 release gate 不得将其当作 production target 使用，packaging 注释也不得把 Android/iOS 描述为当前受支持的平台。

## 晋级门槛

只有具备以下全部条件，移动端才能从 **Design-only** 晋级为 **Experimental**：

- 明确的 runtime/toolchain 与可复现 build 入口；
- 保持 Markdown 可移植性的平台注册数据权威设计；
- permissions、background execution、secure storage 的 threat model；
- 证明共享 note/task/link 语义的 contract tests；
- 用户文件的 migration/backup/recovery 行为；
- 至少一种真实设备类别上的 accessibility 与 lifecycle 测试；
- `PRODUCT.md` 与 `CAPABILITY-MATURITY.md` 中明确的支持矩阵。

晋级 **Production** 还要求 release packaging、signing/trust policy、crash/diagnostic 支持、upgrade/rollback，以及与桌面端相同的 release-evidence 标准。

## 当前版本的非目标

- 不宣称 Android 或 iOS feature parity；
- 桌面 release 集中不包含移动 installer/package；
- 不给桌面 internals 引入移动端专用兼容负担；
- 不仅为了未来移动工作而强制引入 cloud account。
