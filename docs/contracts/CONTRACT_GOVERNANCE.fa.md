<div dir="rtl" lang="fa">

# حاکمیت Contractهای V1

[English](CONTRACT_GOVERNANCE.md) · [简体中文](CONTRACT_GOVERNANCE.zh-CN.md) · [Русский](CONTRACT_GOVERNANCE.ru.md) · [Deutsch](CONTRACT_GOVERNANCE.de.md) · [Español](CONTRACT_GOVERNANCE.es.md) · **فارسی**

contractها رابط دقیق بین renderer اسکریپتور، native moduleها، CLI، ابزارهای MCP، pluginها و testها هستند.

## قواعد V1

- هر command یک identifier پایدار، owner، permission level، typed input/output، typed error code، audit behavior و mutation/rollback statement دارد.
- implementationهای Rust و TypeScript contractها در یک change packet با هم تغییر می‌کنند. native code حق ندارد رفتاری خارج از contract ایجاد کند.
- contract نسخه v1 فقط schema اعلام‌شده خودش را می‌پذیرد. fieldهای unknown، renamed و obsolete در boundary رد می‌شوند و compatibility adapter عرضه نمی‌شود.
- هر contract break عمدی یک نسخه جدید محصول است و به replacement contract، behavioral test، source-contract coverage، docs، changelog baseline update و release verification نیاز دارد.

## Review ضروری

| Contract area | Required owners |
|---|---|
| Vault, note, path, save | Core Contracts, Vault Kernel, Native Platform |
| Search, cache, graph | Core Contracts, Indexing and Search, Knowledge Graph |
| Export, preview | Core Contracts, Publication, Native Platform |
| Canvas | Core Contracts, Canvas Experience, Native Platform |
| MCP, plugin | Core Contracts, Automation and AI, affected capability owner |

</div>
