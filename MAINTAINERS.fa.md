<div dir="ltr" align="center">

[English](MAINTAINERS.md) · **فارسی** · [简体中文](MAINTAINERS.zh-CN.md) · [Русский](MAINTAINERS.ru.md) · [Deutsch](MAINTAINERS.de.md) · [Español](MAINTAINERS.es.md)

</div>

<div dir="rtl" lang="fa" align="right">

# نگه‌دارندگان پروژه

## نگه‌دارنده فعلی

Amirreza “Farnam” Taheri  
ایمیل: [taherifarnam@gmail.com](mailto:taherifarnam@gmail.com)  
GitHub: [@AmirrezaFarnamTaheri](https://github.com/AmirrezaFarnamTaheri)

## مدل مالکیت

مبنای کد منبع بارگذاری‌شده تاریخچهٔ مرجع Git را در خود ندارد؛ بنابراین مالکیت تاریخی و bus factor را نمی‌توان تنها از این artifact اثبات کرد. مخزن اکنون [`.github/CODEOWNERS`](.github/CODEOWNERS) را در بر دارد، اما اعمال واقعی این قواعد توسط سرویس میزبانی و میزان تمرکز review باید در مخزن مرجع بررسی شود. پروژه باید موارد زیر را حفظ کند:

- `CODEOWNERS` برای مسیرهای امنیت، release، هستهٔ Rust، frontend و مستندات؛
- دست‌کم دو reviewer برای تغییرات release و تغییرات حساس امنیتی؛
- گزارش فصلی مالکیت، churn و تاریخچهٔ secretها؛
- tagهای release تغییرناپذیر و محیط‌های production محافظت‌شده.

تا زمانی که نگه‌دارندگان دیگری ثبت نشده‌اند، نگه‌دارندهٔ اصلی مسئول escalation همهٔ حوزه‌هاست. این یک ریسک تداوم پروژه است، نه ساختار تیمی استنباط‌شده.

برای تولید شواهد محلی تاریخچه از یک clone کامل، اجرا کنید:

</div>

<div dir="ltr" align="left">

```bash
bash scripts/governance/history-audit.sh . .history-audit
```

</div>

<div dir="rtl" lang="fa" align="right">

## اختیار انتشار

releaseهای production:

1. از tag با قالب `v<version>` که با [`VERSION`](VERSION) یکسان است آغاز می‌شوند؛
2. باید `.github/workflows/ci.yml` و gateهای compile/package پلتفرمی را بگذرانند؛
3. از مدل اعتماد مستندشده برای installerهای بدون امضا استفاده می‌کنند: هویت دقیق source، checksumهای SHA-256، رکوردهای trust-status وابسته به target، SBOM، release receipt و GitHub provenance attestation؛
4. دقیقاً همان build artifactهای دانلودشده را بدون rebuild در مرحلهٔ publication promote می‌کنند؛
5. checksumها، SBOM، release receipt، metadata اعتماد و attestationهای لازم در قرارداد release evidence را منتشر می‌کنند.

به [`docs/RELEASE-SECURITY.fa.md`](docs/RELEASE-SECURITY.fa.md) مراجعه کنید.

## پشتیبانی و escalation

| موضوع | مسیر |
|---|---|
| امنیت | ایمیل خصوصی مطابق [`SECURITY.fa.md`](SECURITY.fa.md) |
| خطاها/قابلیت‌ها | GitHub Issues |
| مشارکت | [`CONTRIBUTING.fa.md`](CONTRIBUTING.fa.md) |
| مجوزدهی | [`COMMERCIAL-LICENSING.fa.md`](COMMERCIAL-LICENSING.fa.md) |
| وضعیت قابلیت‌ها | [`docs/CAPABILITY-MATURITY.fa.md`](docs/CAPABILITY-MATURITY.fa.md) |

</div>
