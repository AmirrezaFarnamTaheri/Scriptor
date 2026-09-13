<div dir="ltr" align="center">

[English](MAINTAINERS.md) · **فارسی** · [简体中文](MAINTAINERS.zh-CN.md) · [Русский](MAINTAINERS.ru.md) · [Deutsch](MAINTAINERS.de.md) · [Español](MAINTAINERS.es.md)

</div>

<div dir="rtl" lang="fa" align="right">

# نگه‌دارندگان پروژه

## نگه‌دارنده فعلی

<bdi dir="ltr">Amirreza</bdi> “<bdi dir="ltr">Farnam</bdi>” <bdi dir="ltr">Taheri</bdi>  
ایمیل: [<bdi dir="ltr">taherifarnam</bdi>@<bdi dir="ltr">gmail.com</bdi>](mailto:taherifarnam@gmail.com)  
<bdi dir="ltr">GitHub:</bdi> [@<bdi dir="ltr">AmirrezaFarnamTaheri</bdi>](https://github.com/AmirrezaFarnamTaheri)

## مدل مالکیت

مبنای کد منبع بارگذاری‌شده تاریخچهٔ مرجع <bdi dir="ltr">Git</bdi> را در خود ندارد؛ بنابراین مالکیت تاریخی و <bdi dir="ltr">bus factor</bdi> را نمی‌توان تنها از این <bdi dir="ltr">artifact</bdi> اثبات کرد. مخزن اکنون [`.github/CODEOWNERS`](.github/CODEOWNERS) را در بر دارد، اما اعمال واقعی این قواعد توسط سرویس میزبانی و میزان تمرکز <bdi dir="ltr">review</bdi> باید در مخزن مرجع بررسی شود. پروژه باید موارد زیر را حفظ کند:

- `CODEOWNERS` برای مسیرهای امنیت، <bdi dir="ltr">release</bdi>، هستهٔ <bdi dir="ltr">Rust</bdi>، <bdi dir="ltr">frontend</bdi> و مستندات؛
- دست‌کم دو <bdi dir="ltr">reviewer</bdi> برای تغییرات <bdi dir="ltr">release</bdi> و تغییرات حساس امنیتی؛
- گزارش فصلی مالکیت، <bdi dir="ltr">churn</bdi> و تاریخچهٔ <bdi dir="ltr">secret</bdi>ها؛
- <bdi dir="ltr">tag</bdi>های <bdi dir="ltr">release</bdi> تغییرناپذیر و محیط‌های <bdi dir="ltr">production</bdi> محافظت‌شده.

تا زمانی که نگه‌دارندگان دیگری ثبت نشده‌اند، نگه‌دارندهٔ اصلی مسئول <bdi dir="ltr">escalation</bdi> همهٔ حوزه‌هاست. این یک ریسک تداوم پروژه است، نه ساختار تیمی استنباط‌شده.

برای تولید شواهد محلی تاریخچه از یک <bdi dir="ltr">clone</bdi> کامل، اجرا کنید:

</div>

<div dir="ltr" align="left">

```bash
bash scripts/governance/history-audit.sh . .history-audit
```

</div>

<div dir="rtl" lang="fa" align="right">

## اختیار انتشار

<bdi dir="ltr">release</bdi>های <bdi dir="ltr">production:</bdi>

1. از <bdi dir="ltr">tag</bdi> با قالب `v<version>` که با [`VERSION`](VERSION) یکسان است آغاز می‌شوند؛
2. باید `.github/workflows/ci.yml` و <bdi dir="ltr">gate</bdi>های <bdi dir="ltr">compile/package</bdi> پلتفرمی را بگذرانند؛
3. از مدل اعتماد مستندشده برای <bdi dir="ltr">installer</bdi>های بدون امضا استفاده می‌کنند: هویت دقیق <bdi dir="ltr">source</bdi>، <bdi dir="ltr">checksum</bdi>های <bdi dir="ltr">SHA-256</bdi>، رکوردهای <bdi dir="ltr">trust-status</bdi> وابسته به <bdi dir="ltr">target</bdi>، <bdi dir="ltr">SBOM</bdi>، <bdi dir="ltr">release receipt</bdi> و <bdi dir="ltr">GitHub provenance attestation</bdi>؛
4. دقیقاً همان <bdi dir="ltr">build artifact</bdi>های دانلودشده را بدون <bdi dir="ltr">rebuild</bdi> در مرحلهٔ <bdi dir="ltr">publication promote</bdi> می‌کنند؛
5. <bdi dir="ltr">checksum</bdi>ها، <bdi dir="ltr">SBOM</bdi>، <bdi dir="ltr">release receipt</bdi>، <bdi dir="ltr">metadata</bdi> اعتماد و <bdi dir="ltr">attestation</bdi>های لازم در قرارداد <bdi dir="ltr">release evidence</bdi> را منتشر می‌کنند.

به [`docs/RELEASE-SECURITY.fa.md`](docs/RELEASE-SECURITY.fa.md) مراجعه کنید.

## پشتیبانی و <bdi dir="ltr">escalation</bdi>

| موضوع | مسیر |
|---|---|
| امنیت | ایمیل خصوصی مطابق [`SECURITY.fa.md`](SECURITY.fa.md) |
| خطاها/قابلیت‌ها | <bdi dir="ltr">GitHub Issues</bdi> |
| مشارکت | [`CONTRIBUTING.fa.md`](CONTRIBUTING.fa.md) |
| مجوزدهی | [`COMMERCIAL-LICENSING.fa.md`](COMMERCIAL-LICENSING.fa.md) |
| وضعیت قابلیت‌ها | [`docs/CAPABILITY-MATURITY.fa.md`](docs/CAPABILITY-MATURITY.fa.md) |

</div>
