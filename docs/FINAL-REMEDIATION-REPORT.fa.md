<div dir="ltr" align="center">
[English](FINAL-REMEDIATION-REPORT.md) · **فارسی** · [简体中文](FINAL-REMEDIATION-REPORT.zh-CN.md) · [Русский](FINAL-REMEDIATION-REPORT.ru.md) · [Deutsch](FINAL-REMEDIATION-REPORT.de.md) · [Español](FINAL-REMEDIATION-REPORT.es.md)
</div>

<div dir="rtl" lang="fa" align="right">

# خط مبنای محصول V1

**نسخه محصول:** در [`VERSION`](../VERSION) نگه‌داری می‌شود  
**قرارداد:** یک منبع فعلی، یک API و یک schema برای persisted state.

## مرز محصول

<bdi dir="ltr">Scriptor</bdi> v1 برای هر دغدغه ماندگار یک مرجع اختیار دارد:

- <bdi dir="ltr">vault</bdi> مالک محتوا، تصمیم‌های capability، audit recordها و داده‌های بازیابی است؛
- آداپتورهای native هر عملیات filesystem، process، IPC و capability-sensitive را validate و authorize می‌کنند؛
- <bdi dir="ltr">renderer</bdi> فقط مالک presentation state، چرخه عمر request و read modelهای cacheشده است؛
- قراردادهای package رابط دقیق renderer، desktop، daemon، CLI، MCP و plugin را تعریف می‌کنند.

داده browser که persist می‌شود باید از envelope فعلی و validateشده استفاده کند. مقادیر نامعتبر یا منسوخ quarantine می‌شوند و هرگز به‌عنوان state زنده تفسیر نمی‌شوند. state افزونه در vault نگه‌داری می‌شود. ذخیره‌سازی Canvas از شناسه‌های canonical استفاده می‌کند و فایل‌های noncanonical را رد می‌کند.

## الزامات انتشار V1

یک release فقط زمانی واجد شرایط است که exact source head همه بررسی‌های applicable مربوط به locked dependency، Rust، browser، accessibility، desktop، artifact و recovery در [`VERIFICATION.fa.md`](VERIFICATION.fa.md) را گذرانده باشد. artifactهای release باید از tag تغییرناپذیر `v1.0.0` ساخته و مطابق [`RELEASE-SECURITY.fa.md`](RELEASE-SECURITY.fa.md) به checksumها، SBOMها، receiptها و GitHub attestationها متصل شوند.

قابلیت‌های آزمایشی تا زمانی که الزامات graduation در [`CAPABILITY-MATURITY.fa.md`](CAPABILITY-MATURITY.fa.md) را برآورده نکنند، از ادعاهای محصول پشتیبانی‌شده خارج می‌مانند.

## بهداشت مخزن

درخت منتشرشده فقط شامل مستندات فعلی محصول و اپراتور است. planهای منسوخ، review packetها، forensic snapshotها و ورودی‌های تاریخی changelog عمداً بخشی از قرارداد v1 نیستند.


</div>
