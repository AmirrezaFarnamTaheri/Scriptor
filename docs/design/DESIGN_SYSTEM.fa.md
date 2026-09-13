<div dir="ltr" align="center">
[English](DESIGN_SYSTEM.md) · **فارسی** · [简体中文](DESIGN_SYSTEM.zh-CN.md) · [Русский](DESIGN_SYSTEM.ru.md) · [Deutsch](DESIGN_SYSTEM.de.md) · [Español](DESIGN_SYSTEM.es.md)
</div>

<div dir="rtl" lang="fa" align="right">

<div dir="rtl" lang="fa">

# سیستم طراحی Scriptor

[English](DESIGN_SYSTEM.md) · [简体中文](DESIGN_SYSTEM.zh-CN.md) · [Русский](DESIGN_SYSTEM.ru.md) · [Deutsch](DESIGN_SYSTEM.de.md) · [Español](DESIGN_SYSTEM.es.md) · **فارسی**

زبان بصری حرفه‌ای و glass-forward برای desktop و mobile. tokenها در <bdi dir="ltr">`src/index.css`</bdi> و <bdi dir="ltr">`src/styles/tokens/components.css`</bdi> تعریف شده‌اند و از طریق classهای semantic در <bdi dir="ltr">`src/App.css`</bdi> و <bdi dir="ltr">`src/styles/motion.css`</bdi> اعمال می‌شوند.

## پالت رنگ

### Light (<bdi dir="ltr">`data-theme="light"`</bdi>)

| Token | Hex | نقش |
|---|---|---|
| <bdi dir="ltr">`--bg`</bdi> | <bdi dir="ltr">`#F6F8FC`</bdi> | بوم برنامه |
| <bdi dir="ltr">`--bg-elevated`</bdi> | <bdi dir="ltr">`#FFFFFF`</bdi> | سطح elevated |
| <bdi dir="ltr">`--ink-strong`</bdi> | <bdi dir="ltr">`#0F172A`</bdi> | متن اصلی |
| <bdi dir="ltr">`--ink`</bdi> | <bdi dir="ltr">`#1E293B`</bdi> | متن بدنه |
| <bdi dir="ltr">`--muted`</bdi> | <bdi dir="ltr">`#64748B`</bdi> | متن ثانویه |
| <bdi dir="ltr">`--primary`</bdi> | <bdi dir="ltr">`#0D9488`</bdi> | accent / link |
| <bdi dir="ltr">`--primary-strong`</bdi> | <bdi dir="ltr">`#0F766E`</bdi> | accent فعال |
| <bdi dir="ltr">`--glass-bg`</bdi> | <bdi dir="ltr">`rgba(255,255,255,0.72)`</bdi> | panel مات |
| <bdi dir="ltr">`--glass-border`</bdi> | <bdi dir="ltr">`rgba(148,163,184,0.35)`</bdi> | لبه glass |

### Dark (<bdi dir="ltr">`data-theme="dark"`</bdi>)

| Token | Hex | نقش |
|---|---|---|
| <bdi dir="ltr">`--bg`</bdi> | <bdi dir="ltr">`#070B14`</bdi> | بوم برنامه |
| <bdi dir="ltr">`--bg-elevated`</bdi> | <bdi dir="ltr">`#0F172A`</bdi> | سطح elevated |
| <bdi dir="ltr">`--ink-strong`</bdi> | <bdi dir="ltr">`#F8FAFC`</bdi> | متن اصلی |
| <bdi dir="ltr">`--ink`</bdi> | <bdi dir="ltr">`#E2E8F0`</bdi> | متن بدنه |
| <bdi dir="ltr">`--muted`</bdi> | <bdi dir="ltr">`#94A3B8`</bdi> | متن ثانویه |
| <bdi dir="ltr">`--primary`</bdi> | <bdi dir="ltr">`#2DD4BF`</bdi> | accent |
| <bdi dir="ltr">`--primary-strong`</bdi> | <bdi dir="ltr">`#14B8A6`</bdi> | accent فعال |
| <bdi dir="ltr">`--glass-bg`</bdi> | <bdi dir="ltr">`rgba(15,23,42,0.65)`</bdi> | panel مات |
| <bdi dir="ltr">`--glass-border`</bdi> | <bdi dir="ltr">`rgba(148,163,184,0.18)`</bdi> | لبه glass |

## Typography

| Token | Value |
|---|---|
| <bdi dir="ltr">`--font-display`</bdi> | <bdi dir="ltr">`Sora, Inter, system-ui`</bdi> |
| <bdi dir="ltr">`--font-body`</bdi> | <bdi dir="ltr">`Inter, system-ui`</bdi> |
| <bdi dir="ltr">`--font-mono`</bdi> | <bdi dir="ltr">`JetBrains Mono, Cascadia Code, monospace`</bdi> |
| <bdi dir="ltr">`--text-xs`</bdi> | <bdi dir="ltr">`11px / 1.35`</bdi> |
| <bdi dir="ltr">`--text-sm`</bdi> | <bdi dir="ltr">`13px / 1.45`</bdi> |
| <bdi dir="ltr">`--text-base`</bdi> | <bdi dir="ltr">`14px / 1.5`</bdi> |
| <bdi dir="ltr">`--text-lg`</bdi> | <bdi dir="ltr">`16px / 1.45`</bdi> |
| <bdi dir="ltr">`--text-xl`</bdi> | <bdi dir="ltr">`20px / 1.3`</bdi> |
| <bdi dir="ltr">`--text-2xl`</bdi> | <bdi dir="ltr">`26px / 1.2`</bdi> |

## مقیاس فاصله

از <bdi dir="ltr">`--space-1` (4px)</bdi> تا <bdi dir="ltr">`--space-8` (40px)</bdi> با گام 4px.

## Radius

| Token | Value |
|---|---|
| <bdi dir="ltr">`--radius-sm`</bdi> | <bdi dir="ltr">`10px`</bdi> |
| <bdi dir="ltr">`--radius-md`</bdi> | <bdi dir="ltr">`14px`</bdi> |
| <bdi dir="ltr">`--radius-lg`</bdi> | <bdi dir="ltr">`20px`</bdi> |
| <bdi dir="ltr">`--radius-xl`</bdi> | <bdi dir="ltr">`28px`</bdi> |
| <bdi dir="ltr">`--radius-pill`</bdi> | <bdi dir="ltr">`999px`</bdi> |

## عمق و Glass

| Token | کاربرد |
|---|---|
| <bdi dir="ltr">`--shadow-sm`</bdi> | button، chip |
| <bdi dir="ltr">`--shadow-md`</bdi> | panel، card |
| <bdi dir="ltr">`--shadow-lg`</bdi> | modal، command palette |
| <bdi dir="ltr">`--glass-blur`</bdi> | <bdi dir="ltr">`blur(18px) saturate(1.4)`</bdi> |
| <bdi dir="ltr">`--glass-highlight`</bdi> | highlight لبه بالایی سطح frosted |

## Motion

| Token | Curve | کاربرد |
|---|---|---|
| <bdi dir="ltr">`--spring-fast`</bdi> | <bdi dir="ltr">`cubic-bezier(0.34, 1.56, 0.64, 1)`</bdi> | press، toggle |
| <bdi dir="ltr">`--spring-soft`</bdi> | <bdi dir="ltr">`cubic-bezier(0.22, 1, 0.36, 1)`</bdi> | panel reveal |
| <bdi dir="ltr">`--spring-gentle`</bdi> | <bdi dir="ltr">`cubic-bezier(0.16, 1, 0.3, 1)`</bdi> | page transition |

<bdi dir="ltr">`prefers-reduced-motion: reduce`</bdi> باید رعایت شود؛ animation به تغییر state آنی تبدیل می‌شود.

## Primitiveهای Component

- <bdi dir="ltr">`.surface-glass`</bdi> — panel frosted با backdrop blur
- <bdi dir="ltr">`.pressable`</bdi> — button لمسی با spring scale در active
- <bdi dir="ltr">`.elevate-hover`</bdi> — lift نرم روی hover
- <bdi dir="ltr">`.fade-rise`</bdi> — entrance animation برای overlay

</div>


</div>
