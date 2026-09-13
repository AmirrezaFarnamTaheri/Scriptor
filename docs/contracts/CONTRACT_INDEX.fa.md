<div dir="ltr" align="center">
[English](CONTRACT_INDEX.md) · **فارسی** · [简体中文](CONTRACT_INDEX.zh-CN.md) · [Русский](CONTRACT_INDEX.ru.md) · [Deutsch](CONTRACT_INDEX.de.md) · [Español](CONTRACT_INDEX.es.md)
</div>

<div dir="rtl" lang="fa" align="right">

<div dir="rtl" lang="fa">

# فهرست <bdi dir="ltr">Contract</bdi>ها

[<bdi dir="ltr">English</bdi>](CONTRACT_INDEX.md) · [简体中文](CONTRACT_INDEX.zh-CN.md) · [Русский](CONTRACT_INDEX.ru.md) · [<bdi dir="ltr">Deutsch</bdi>](CONTRACT_INDEX.de.md) · [<bdi dir="ltr">Espa</bdi>ñ<bdi dir="ltr">ol</bdi>](CONTRACT_INDEX.es.md) · **فارسی**

## قواعد <bdi dir="ltr">Contract</bdi>

- <bdi dir="ltr">contract</bdi> پیش از <bdi dir="ltr">implementation</bdi> رفتار را تعریف می‌کند.
- <bdi dir="ltr">contract</bdi> باید آن‌قدر پایدار باشد که <bdi dir="ltr">UI</bdi>، <bdi dir="ltr">CLI</bdi>، <bdi dir="ltr">MCP</bdi> و <bdi dir="ltr">test</bdi> به‌صورت مشترک استفاده کنند.
- هر <bdi dir="ltr">command</bdi>، <bdi dir="ltr">owner</bdi>، <bdi dir="ltr">permission</bdi>، <bdi dir="ltr">input</bdi>، <bdi dir="ltr">output</bdi>، <bdi dir="ltr">error</bdi> و <bdi dir="ltr">rollback</bdi> را اعلام می‌کند.
- <bdi dir="ltr">implementation</bdi> بومی <bdi dir="ltr">Rust</bdi> نباید رفتاری خارج از <bdi dir="ltr">TypeScript contract</bdi> ایجاد کند.
- <bdi dir="ltr">contract</bdi> می‌تواند <bdi dir="ltr">experimental</bdi> باشد، اما وضعیت باید صریح باشد.

## <bdi dir="ltr">Contract</bdi>های اولیه

| <bdi dir="ltr">Contract</bdi> | <bdi dir="ltr">File</bdi> | <bdi dir="ltr">Owner</bdi> | <bdi dir="ltr">Status</bdi> |
|---|---|---|---|
| <bdi dir="ltr">Command envelope</bdi> | <bdi dir="ltr">`packages/core/src/contracts/command.ts`</bdi> | <bdi dir="ltr">Core Contracts</bdi> | <bdi dir="ltr">Shipped</bdi> |
| <bdi dir="ltr">Canvas</bdi> | <bdi dir="ltr">`packages/core/src/contracts/canvas.ts`</bdi> | <bdi dir="ltr">Canvas Experience</bdi>, <bdi dir="ltr">Core Contracts</bdi> | <bdi dir="ltr">Shipped</bdi> |
| <bdi dir="ltr">Vault</bdi> | <bdi dir="ltr">`packages/core/src/contracts/vault.ts`</bdi> | <bdi dir="ltr">Vault Kernel</bdi> | <bdi dir="ltr">Shipped</bdi> |
| <bdi dir="ltr">Notes</bdi> | <bdi dir="ltr">`packages/core/src/contracts/note.ts`</bdi> | <bdi dir="ltr">Vault Kernel</bdi>, <bdi dir="ltr">Editor Experience</bdi> | <bdi dir="ltr">Shipped</bdi> |
| <bdi dir="ltr">Graph</bdi> | <bdi dir="ltr">`packages/core/src/contracts/graph.ts`</bdi> | <bdi dir="ltr">Knowledge Graph</bdi> | <bdi dir="ltr">Shipped</bdi> |
| <bdi dir="ltr">Export</bdi> | <bdi dir="ltr">`packages/core/src/contracts/export.ts`</bdi> | <bdi dir="ltr">Publication</bdi> | <bdi dir="ltr">Shipped</bdi> |
| <bdi dir="ltr">Jobs</bdi> | <bdi dir="ltr">`packages/core/src/contracts/job.ts`</bdi> | <bdi dir="ltr">Native Platform</bdi> | <bdi dir="ltr">Shipped</bdi> |
| <bdi dir="ltr">MCP</bdi> | <bdi dir="ltr">`packages/core/src/contracts/mcp.ts`</bdi> | <bdi dir="ltr">Automation And AI</bdi> | <bdi dir="ltr">Shipped</bdi> |
| <bdi dir="ltr">Plugin</bdi> | <bdi dir="ltr">`packages/core/src/contracts/plugin.ts`</bdi> | <bdi dir="ltr">Core Contracts</bdi>, <bdi dir="ltr">Automation And AI</bdi> | <bdi dir="ltr">Shipped</bdi> |

## مدل <bdi dir="ltr">Permission</bdi>

| <bdi dir="ltr">Permission</bdi> | معنا |
|---|---|
| <bdi dir="ltr">`read`</bdi> | <bdi dir="ltr">derived/canonical data</bdi> را بدون <bdi dir="ltr">mutation</bdi> می‌خواند. |
| <bdi dir="ltr">`write-approved`</bdi> | فقط پس از <bdi dir="ltr">approval</bdi> صریح کاربر یا <bdi dir="ltr">trusted UI command</bdi> فایل <bdi dir="ltr">vault</bdi> را تغییر می‌دهد. |
| <bdi dir="ltr">`system`</bdi> | <bdi dir="ltr">derived cache</bdi>، <bdi dir="ltr">job</bdi> یا <bdi dir="ltr">local app state</bdi> را تغییر می‌دهد. |
| <bdi dir="ltr">`dangerous`</bdi> | <bdi dir="ltr">command destructive/external</bdi>؛ <bdi dir="ltr">confirmation</bdi> و <bdi dir="ltr">audit</bdi> لازم است. |

## مدل <bdi dir="ltr">Error</bdi>

هر <bdi dir="ltr">command error</bdi> باید شامل این موارد باشد:

- <bdi dir="ltr">`code`</bdi> پایدار؛
- <bdi dir="ltr">`message`</bdi> خوانا؛
- <bdi dir="ltr">boolean</bdi> <bdi dir="ltr">`recoverable`</bdi>؛
- <bdi dir="ltr">`details`</bdi> اختیاری؛
- <bdi dir="ltr">`rollbackHint`</bdi> اختیاری.

</div>


</div>
