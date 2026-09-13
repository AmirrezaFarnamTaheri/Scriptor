<div dir="ltr" align="center">
[English](CONTRACT_GOVERNANCE.md) · **فارسی** · [简体中文](CONTRACT_GOVERNANCE.zh-CN.md) · [Русский](CONTRACT_GOVERNANCE.ru.md) · [Deutsch](CONTRACT_GOVERNANCE.de.md) · [Español](CONTRACT_GOVERNANCE.es.md)
</div>

<div dir="rtl" lang="fa" align="right">

<div dir="rtl" lang="fa">

# حاکمیت <bdi dir="ltr">Contract</bdi>های <bdi dir="ltr">V1</bdi>

[<bdi dir="ltr">English</bdi>](CONTRACT_GOVERNANCE.md) · [简体中文](CONTRACT_GOVERNANCE.zh-CN.md) · [Русский](CONTRACT_GOVERNANCE.ru.md) · [<bdi dir="ltr">Deutsch</bdi>](CONTRACT_GOVERNANCE.de.md) · [<bdi dir="ltr">Espa</bdi>ñ<bdi dir="ltr">ol</bdi>](CONTRACT_GOVERNANCE.es.md) · **فارسی**

<bdi dir="ltr">contract</bdi>ها رابط دقیق بین <bdi dir="ltr">renderer</bdi> اسکریپتور، <bdi dir="ltr">native module</bdi>ها، <bdi dir="ltr">CLI</bdi>، ابزارهای <bdi dir="ltr">MCP</bdi>، <bdi dir="ltr">plugin</bdi>ها و <bdi dir="ltr">test</bdi>ها هستند.

## قواعد <bdi dir="ltr">V1</bdi>

- هر <bdi dir="ltr">command</bdi> یک <bdi dir="ltr">identifier</bdi> پایدار، <bdi dir="ltr">owner</bdi>، <bdi dir="ltr">permission level</bdi>، <bdi dir="ltr">typed input/output</bdi>، <bdi dir="ltr">typed error code</bdi>، <bdi dir="ltr">audit behavior</bdi> و <bdi dir="ltr">mutation/rollback statement</bdi> دارد.
- <bdi dir="ltr">implementation</bdi>های <bdi dir="ltr">Rust</bdi> و <bdi dir="ltr">TypeScript contract</bdi>ها در یک <bdi dir="ltr">change packet</bdi> با هم تغییر می‌کنند. <bdi dir="ltr">native code</bdi> حق ندارد رفتاری خارج از <bdi dir="ltr">contract</bdi> ایجاد کند.
- <bdi dir="ltr">contract</bdi> نسخه <bdi dir="ltr">v1</bdi> فقط <bdi dir="ltr">schema</bdi> اعلام‌شده خودش را می‌پذیرد. <bdi dir="ltr">field</bdi>های <bdi dir="ltr">unknown</bdi>، <bdi dir="ltr">renamed</bdi> و <bdi dir="ltr">obsolete</bdi> در <bdi dir="ltr">boundary</bdi> رد می‌شوند و <bdi dir="ltr">compatibility adapter</bdi> عرضه نمی‌شود.
- هر <bdi dir="ltr">contract break</bdi> عمدی یک نسخه جدید محصول است و به <bdi dir="ltr">replacement contract</bdi>، <bdi dir="ltr">behavioral test</bdi>، <bdi dir="ltr">source-contract coverage</bdi>، <bdi dir="ltr">docs</bdi>، <bdi dir="ltr">changelog baseline update</bdi> و <bdi dir="ltr">release verification</bdi> نیاز دارد.

## <bdi dir="ltr">Review</bdi> ضروری

| <bdi dir="ltr">Contract area</bdi> | <bdi dir="ltr">Required owners</bdi> |
|---|---|
| <bdi dir="ltr">Vault</bdi>, <bdi dir="ltr">note</bdi>, <bdi dir="ltr">path</bdi>, <bdi dir="ltr">save</bdi> | <bdi dir="ltr">Core Contracts</bdi>, <bdi dir="ltr">Vault Kernel</bdi>, <bdi dir="ltr">Native Platform</bdi> |
| <bdi dir="ltr">Search</bdi>, <bdi dir="ltr">cache</bdi>, <bdi dir="ltr">graph</bdi> | <bdi dir="ltr">Core Contracts</bdi>, <bdi dir="ltr">Indexing and Search</bdi>, <bdi dir="ltr">Knowledge Graph</bdi> |
| <bdi dir="ltr">Export</bdi>, <bdi dir="ltr">preview</bdi> | <bdi dir="ltr">Core Contracts</bdi>, <bdi dir="ltr">Publication</bdi>, <bdi dir="ltr">Native Platform</bdi> |
| <bdi dir="ltr">Canvas</bdi> | <bdi dir="ltr">Core Contracts</bdi>, <bdi dir="ltr">Canvas Experience</bdi>, <bdi dir="ltr">Native Platform</bdi> |
| <bdi dir="ltr">MCP</bdi>, <bdi dir="ltr">plugin</bdi> | <bdi dir="ltr">Core Contracts</bdi>, <bdi dir="ltr">Automation and AI</bdi>, <bdi dir="ltr">affected capability owner</bdi> |

</div>


</div>
