<div dir="ltr" align="center">
[English](FINAL-REMEDIATION-REPORT.md) · **فارسی** · [简体中文](FINAL-REMEDIATION-REPORT.zh-CN.md) · [Русский](FINAL-REMEDIATION-REPORT.ru.md) · [Deutsch](FINAL-REMEDIATION-REPORT.de.md) · [Español](FINAL-REMEDIATION-REPORT.es.md)
</div>

<div dir="rtl" lang="fa" align="right">

# خط مبنای محصول <bdi dir="ltr">V1</bdi>

**نسخه محصول:** در [`VERSION`](../VERSION) نگه‌داری می‌شود  
**قرارداد:** یک منبع فعلی، یک <bdi dir="ltr">API</bdi> و یک <bdi dir="ltr">schema</bdi> برای <bdi dir="ltr">persisted state.</bdi>

## مرز محصول

<bdi dir="ltr">Scriptor</bdi> <bdi dir="ltr">v1</bdi> برای هر دغدغه ماندگار یک مرجع اختیار دارد:

- <bdi dir="ltr">vault</bdi> مالک محتوا، تصمیم‌های <bdi dir="ltr">capability</bdi>، <bdi dir="ltr">audit record</bdi>ها و داده‌های بازیابی است؛
- آداپتورهای <bdi dir="ltr">native</bdi> هر عملیات <bdi dir="ltr">filesystem</bdi>، <bdi dir="ltr">process</bdi>، <bdi dir="ltr">IPC</bdi> و <bdi dir="ltr">capability-sensitive</bdi> را <bdi dir="ltr">validate</bdi> و <bdi dir="ltr">authorize</bdi> می‌کنند؛
- <bdi dir="ltr">renderer</bdi> فقط مالک <bdi dir="ltr">presentation state</bdi>، چرخه عمر <bdi dir="ltr">request</bdi> و <bdi dir="ltr">read model</bdi>های <bdi dir="ltr">cache</bdi>شده است؛
- قراردادهای <bdi dir="ltr">package</bdi> رابط دقیق <bdi dir="ltr">renderer</bdi>، <bdi dir="ltr">desktop</bdi>، <bdi dir="ltr">daemon</bdi>، <bdi dir="ltr">CLI</bdi>، <bdi dir="ltr">MCP</bdi> و <bdi dir="ltr">plugin</bdi> را تعریف می‌کنند.

داده <bdi dir="ltr">browser</bdi> که <bdi dir="ltr">persist</bdi> می‌شود باید از <bdi dir="ltr">envelope</bdi> فعلی و <bdi dir="ltr">validate</bdi>شده استفاده کند. مقادیر نامعتبر یا منسوخ <bdi dir="ltr">quarantine</bdi> می‌شوند و هرگز به‌عنوان <bdi dir="ltr">state</bdi> زنده تفسیر نمی‌شوند. <bdi dir="ltr">state</bdi> افزونه در <bdi dir="ltr">vault</bdi> نگه‌داری می‌شود. ذخیره‌سازی <bdi dir="ltr">Canvas</bdi> از شناسه‌های <bdi dir="ltr">canonical</bdi> استفاده می‌کند و فایل‌های <bdi dir="ltr">noncanonical</bdi> را رد می‌کند.

## الزامات انتشار <bdi dir="ltr">V1</bdi>

یک <bdi dir="ltr">release</bdi> فقط زمانی واجد شرایط است که <bdi dir="ltr">exact source head</bdi> همه بررسی‌های <bdi dir="ltr">applicable</bdi> مربوط به <bdi dir="ltr">locked dependency</bdi>، <bdi dir="ltr">Rust</bdi>، <bdi dir="ltr">browser</bdi>، <bdi dir="ltr">accessibility</bdi>، <bdi dir="ltr">desktop</bdi>، <bdi dir="ltr">artifact</bdi> و <bdi dir="ltr">recovery</bdi> در [`VERIFICATION.fa.md`](VERIFICATION.fa.md) را گذرانده باشد. <bdi dir="ltr">artifact</bdi>های <bdi dir="ltr">release</bdi> باید از <bdi dir="ltr">tag</bdi> تغییرناپذیر `v1.0.0` ساخته و مطابق [`RELEASE-SECURITY.fa.md`](RELEASE-SECURITY.fa.md) به <bdi dir="ltr">checksum</bdi>ها، <bdi dir="ltr">SBOM</bdi>ها، <bdi dir="ltr">receipt</bdi>ها و <bdi dir="ltr">GitHub attestation</bdi>ها متصل شوند.

قابلیت‌های آزمایشی تا زمانی که الزامات <bdi dir="ltr">graduation</bdi> در [`CAPABILITY-MATURITY.fa.md`](CAPABILITY-MATURITY.fa.md) را برآورده نکنند، از ادعاهای محصول پشتیبانی‌شده خارج می‌مانند.

## بهداشت مخزن

درخت منتشرشده فقط شامل مستندات فعلی محصول و اپراتور است. <bdi dir="ltr">plan</bdi>های منسوخ، <bdi dir="ltr">review packet</bdi>ها، <bdi dir="ltr">forensic snapshot</bdi>ها و ورودی‌های تاریخی <bdi dir="ltr">changelog</bdi> عمداً بخشی از قرارداد <bdi dir="ltr">v1</bdi> نیستند.


</div>
