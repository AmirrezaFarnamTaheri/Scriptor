<div dir="rtl" lang="fa">

# فهرست Contractها

[English](CONTRACT_INDEX.md) · [简体中文](CONTRACT_INDEX.zh-CN.md) · [Русский](CONTRACT_INDEX.ru.md) · [Deutsch](CONTRACT_INDEX.de.md) · [Español](CONTRACT_INDEX.es.md) · **فارسی**

## قواعد Contract

- contract پیش از implementation رفتار را تعریف می‌کند.
- contract باید آن‌قدر پایدار باشد که UI، CLI، MCP و test به‌صورت مشترک استفاده کنند.
- هر command، owner، permission، input، output، error و rollback را اعلام می‌کند.
- implementation بومی Rust نباید رفتاری خارج از TypeScript contract ایجاد کند.
- contract می‌تواند experimental باشد، اما وضعیت باید صریح باشد.

## Contractهای اولیه

| Contract | File | Owner | Status |
|---|---|---|---|
| Command envelope | <bdi dir="ltr">`packages/core/src/contracts/command.ts`</bdi> | Core Contracts | Shipped |
| Canvas | <bdi dir="ltr">`packages/core/src/contracts/canvas.ts`</bdi> | Canvas Experience, Core Contracts | Shipped |
| Vault | <bdi dir="ltr">`packages/core/src/contracts/vault.ts`</bdi> | Vault Kernel | Shipped |
| Notes | <bdi dir="ltr">`packages/core/src/contracts/note.ts`</bdi> | Vault Kernel, Editor Experience | Shipped |
| Graph | <bdi dir="ltr">`packages/core/src/contracts/graph.ts`</bdi> | Knowledge Graph | Shipped |
| Export | <bdi dir="ltr">`packages/core/src/contracts/export.ts`</bdi> | Publication | Shipped |
| Jobs | <bdi dir="ltr">`packages/core/src/contracts/job.ts`</bdi> | Native Platform | Shipped |
| MCP | <bdi dir="ltr">`packages/core/src/contracts/mcp.ts`</bdi> | Automation And AI | Shipped |
| Plugin | <bdi dir="ltr">`packages/core/src/contracts/plugin.ts`</bdi> | Core Contracts, Automation And AI | Shipped |

## مدل Permission

| Permission | معنا |
|---|---|
| <bdi dir="ltr">`read`</bdi> | derived/canonical data را بدون mutation می‌خواند. |
| <bdi dir="ltr">`write-approved`</bdi> | فقط پس از approval صریح کاربر یا trusted UI command فایل vault را تغییر می‌دهد. |
| <bdi dir="ltr">`system`</bdi> | derived cache، job یا local app state را تغییر می‌دهد. |
| <bdi dir="ltr">`dangerous`</bdi> | command destructive/external؛ confirmation و audit لازم است. |

## مدل Error

هر command error باید شامل این موارد باشد:

- <bdi dir="ltr">`code`</bdi> پایدار؛
- <bdi dir="ltr">`message`</bdi> خوانا؛
- boolean <bdi dir="ltr">`recoverable`</bdi>؛
- <bdi dir="ltr">`details`</bdi> اختیاری؛
- <bdi dir="ltr">`rollbackHint`</bdi> اختیاری.

</div>
