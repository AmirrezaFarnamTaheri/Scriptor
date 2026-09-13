<div dir="ltr" align="center">

[English](BOUNDARY_OUTCOMES.md) · **فارسی** · [简体中文](BOUNDARY_OUTCOMES.zh-CN.md) · [Русский](BOUNDARY_OUTCOMES.ru.md) · [Deutsch](BOUNDARY_OUTCOMES.de.md) · [Español](BOUNDARY_OUTCOMES.es.md)

</div>

<div dir="rtl" lang="fa" align="right">

# قرارداد <bdi dir="ltr">outcome</bdi> در مرزها

<bdi dir="ltr">adapter</bdi>های <bdi dir="ltr">boundary</bdi> در <bdi dir="ltr">Scriptor</bdi> از یک <bdi dir="ltr">algebra</bdi> واحد با شش <bdi dir="ltr">state</bdi> برای <bdi dir="ltr">outcome</bdi> استفاده می‌کنند. هدف این است که نبود واقعی یک مقدار اختیاری، <bdi dir="ltr">state</bdi> ماندگار خراب، نتیجه جزئی، <bdi dir="ltr">failure</bdi> اجرا و <bdi dir="ltr">recovery</bdi> موفق همگی به یک مقدار خالی/<bdi dir="ltr">default</bdi> فروکاسته نشوند.

| وضعیت | قرارداد | <bdi dir="ltr">default</bdi> مجاز است؟ |
| --- | --- | --- |
| `value` | نتیجه <bdi dir="ltr">authoritative</bdi> عملیات. | کاربرد ندارد. |
| `absent-optional` | <bdi dir="ltr">state</bdi> اختیاری واقعاً وجود ندارد. <bdi dir="ltr">caller</bdi> می‌تواند آن را به <bdi dir="ltr">default</bdi> یا مقدار خالی صریحاً مستندشده نگاشت کند. | **بله، فقط اینجا.** |
| `invalid` | <bdi dir="ltr">input</bdi>، <bdi dir="ltr">configuration</bdi>، <bdi dir="ltr">state serialized</bdi> یا داده <bdi dir="ltr">persisted</bdi> بدشکل است. <bdi dir="ltr">code</bdi> و <bdi dir="ltr">message</bdi> تایپ‌شده برگردانید. | خیر. |
| `degraded` | <bdi dir="ltr">state</bdi> جزئیِ مفید موجود است، اما <bdi dir="ltr">warning</bdi>ها بخش‌های حذف‌شده/دردسترس‌نبودن را مشخص می‌کنند. | <bdi dir="ltr">default</bdi> خاموش ممنوع؛ <bdi dir="ltr">warning</bdi> همراه <bdi dir="ltr">value</bdi> حرکت می‌کند. |
| `failed` | عملیات شکست خورده است. <bdi dir="ltr">code</bdi>، <bdi dir="ltr">message</bdi> و منطقی‌بودن <bdi dir="ltr">retry/recovery</bdi> را برگردانید. | خیر. |
| `recovered` | عملیات از یک <bdi dir="ltr">recovery path</bdi> صریح موفق شده است. <bdi dir="ltr">receipt</bdi> بازیابی را حفظ کنید. | رویداد <bdi dir="ltr">recovery</bdi> نباید بی‌صدا پاک شود. |

`contracts/operations.json` <bdi dir="ltr">status</bdi>های مجاز را برای هر <bdi dir="ltr">Tauri command</bdi>، متد <bdi dir="ltr">RPC daemon</bdi>، <bdi dir="ltr">MCP tool</bdi> و <bdi dir="ltr">CLI command</bdi> فهرست‌شده تعیین می‌کند. <bdi dir="ltr">metadata</bdi> تولیدشده <bdi dir="ltr">TypeScript/Rust</bdi> و <bdi dir="ltr">parity check</bdi>ها باعث می‌شوند افزودنی‌ها تا زمان اعلام <bdi dir="ltr">semantics</bdi> مرزی خود <bdi dir="ltr">fail-closed</bdi> بمانند.

## قواعد <bdi dir="ltr">adapter</bdi>

1. در مرزهای <bdi dir="ltr">authoritative</bdi> از `unwrap_or_default`، `.ok()`، `filter_map(Result::ok)` یا معادل آن‌ها استفاده نکنید، مگر این‌که <bdi dir="ltr">contract</bdi> منبع صریحاً `absent-optional` را نمایش دهد.
2. پیکربندی نامعتبر <bdi dir="ltr">vault</bdi> برابر `invalid` است، نه <bdi dir="ltr">absence.</bdi>
3. خطای <bdi dir="ltr">decode</bdi> ردیف <bdi dir="ltr">database</bdi> برابر `failed` یا `degraded` همراه <bdi dir="ltr">warning</bdi> است و هرگز نباید بی‌صدا حذف شود.
4. <bdi dir="ltr">failure</bdi>های <bdi dir="ltr">process/IPC</bdi> از <bdi dir="ltr">code</bdi> ساخت‌یافته و <bdi dir="ltr">recoverability</bdi> استفاده می‌کنند، نه <bdi dir="ltr">string</bdi> بدون <bdi dir="ltr">type.</bdi>
5. <bdi dir="ltr">recovery</bdi> پس از تعمیر <bdi dir="ltr">atomic-write/journal</bdi> برابر `recovered` است؛ اگر <bdi dir="ltr">boundary</bdi> آن را <bdi dir="ltr">expose</bdi> می‌کند <bdi dir="ltr">receipt</bdi> را منتشر یا حفظ کنید.

</div>
