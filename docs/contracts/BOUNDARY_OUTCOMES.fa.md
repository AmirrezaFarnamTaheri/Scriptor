<div dir="ltr" align="center">

[English](BOUNDARY_OUTCOMES.md) · **فارسی** · [简体中文](BOUNDARY_OUTCOMES.zh-CN.md) · [Русский](BOUNDARY_OUTCOMES.ru.md) · [Deutsch](BOUNDARY_OUTCOMES.de.md) · [Español](BOUNDARY_OUTCOMES.es.md)

</div>

<div dir="rtl" lang="fa" align="right">

# قرارداد outcome در مرزها

adapterهای boundary در Scriptor از یک algebra واحد با شش state برای outcome استفاده می‌کنند. هدف این است که نبود واقعی یک مقدار اختیاری، state ماندگار خراب، نتیجه جزئی، failure اجرا و recovery موفق همگی به یک مقدار خالی/default فروکاسته نشوند.

| وضعیت | قرارداد | default مجاز است؟ |
| --- | --- | --- |
| `value` | نتیجه authoritative عملیات. | کاربرد ندارد. |
| `absent-optional` | state اختیاری واقعاً وجود ندارد. caller می‌تواند آن را به default یا مقدار خالی صریحاً مستندشده نگاشت کند. | **بله، فقط اینجا.** |
| `invalid` | input، configuration، state serialized یا داده persisted بدشکل است. code و message تایپ‌شده برگردانید. | خیر. |
| `degraded` | state جزئیِ مفید موجود است، اما warningها بخش‌های حذف‌شده/دردسترس‌نبودن را مشخص می‌کنند. | default خاموش ممنوع؛ warning همراه value حرکت می‌کند. |
| `failed` | عملیات شکست خورده است. code، message و منطقی‌بودن retry/recovery را برگردانید. | خیر. |
| `recovered` | عملیات از یک recovery path صریح موفق شده است. receipt بازیابی را حفظ کنید. | رویداد recovery نباید بی‌صدا پاک شود. |

`contracts/operations.json` statusهای مجاز را برای هر Tauri command، متد RPC daemon، MCP tool و CLI command فهرست‌شده تعیین می‌کند. metadata تولیدشده TypeScript/Rust و parity checkها باعث می‌شوند افزودنی‌ها تا زمان اعلام semantics مرزی خود fail-closed بمانند.

## قواعد adapter

1. در مرزهای authoritative از `unwrap_or_default`، `.ok()`، `filter_map(Result::ok)` یا معادل آن‌ها استفاده نکنید، مگر این‌که contract منبع صریحاً `absent-optional` را نمایش دهد.
2. پیکربندی نامعتبر vault برابر `invalid` است، نه absence.
3. خطای decode ردیف database برابر `failed` یا `degraded` همراه warning است و هرگز نباید بی‌صدا حذف شود.
4. failureهای process/IPC از code ساخت‌یافته و recoverability استفاده می‌کنند، نه string بدون type.
5. recovery پس از تعمیر atomic-write/journal برابر `recovered` است؛ اگر boundary آن را expose می‌کند receipt را منتشر یا حفظ کنید.

</div>
