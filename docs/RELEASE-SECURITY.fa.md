<div dir="ltr" align="center">
[English](RELEASE-SECURITY.md) · **فارسی** · [简体中文](RELEASE-SECURITY.zh-CN.md) · [Русский](RELEASE-SECURITY.ru.md) · [Deutsch](RELEASE-SECURITY.de.md) · [Español](RELEASE-SECURITY.es.md)
</div>

<div dir="rtl" lang="fa" align="right">

<div dir="rtl" lang="fa">

# امنیت و راستی‌آزمایی <bdi dir="ltr">Release</bdi>

[<bdi dir="ltr">English</bdi>](RELEASE-SECURITY.md) · [简体中文](RELEASE-SECURITY.zh-CN.md) · [Русский](RELEASE-SECURITY.ru.md) · [<bdi dir="ltr">Deutsch</bdi>](RELEASE-SECURITY.de.md) · [<bdi dir="ltr">Espa</bdi>ñ<bdi dir="ltr">ol</bdi>](RELEASE-SECURITY.es.md) · **فارسی**

## مرجع نسخه

فایل <bdi dir="ltr">`VERSION`</bdi> مرجع قطعی است. فرمان <bdi dir="ltr">`node scripts/release/version.mjs check`</bdi> وقتی <bdi dir="ltr">npm package</bdi>، <bdi dir="ltr">Cargo package</bdi>، <bdi dir="ltr">Tauri config</bdi>، <bdi dir="ltr">release version</bdi> صریح یا <bdi dir="ltr">release tag</bdi> با آن اختلاف داشته باشد <bdi dir="ltr">fail</bdi> می‌شود. <bdi dir="ltr">branch ref</bdi>هایی که <bdi dir="ltr">tag</bdi> نیستند به‌عنوان <bdi dir="ltr">version</bdi> تفسیر نمی‌شوند. <bdi dir="ltr">`node scripts/release/version.mjs sync`</bdi> فقط در <bdi dir="ltr">branch</bdi> تغییر نسخه که <bdi dir="ltr">review</bdi> شده استفاده می‌شود؛ <bdi dir="ltr">lockfile</bdi>ها پیش از <bdi dir="ltr">merge</bdi> دوباره تولید و بررسی می‌شوند.

## کانال‌ها و مالکیت <bdi dir="ltr">Release</bdi>

- **<bdi dir="ltr">Preview:</bdi>** اجرای دستی با <bdi dir="ltr">`publish: false`</bdi>. نسخه از <bdi dir="ltr">`VERSION`</bdi> مرجع <bdi dir="ltr">checkout</bdi>شده به دست می‌آید، <bdi dir="ltr">workflow artifact</bdi> آپلود می‌شود و هیچ <bdi dir="ltr">GitHub Release</bdi> ساخته نمی‌شود.
- **<bdi dir="ltr">Production:</bdi>** <bdi dir="ltr">tag</bdi> غیرقابل‌تغییر <bdi dir="ltr">`v<version>`</bdi> که مقدارش با <bdi dir="ltr">`VERSION`</bdi> یکی است. فقط <bdi dir="ltr">workflow</bdi> اصلی **<bdi dir="ltr">Release</bdi>** مجاز به ساخت یا تغییر <bdi dir="ltr">GitHub Release</bdi> است.

تغییر <bdi dir="ltr">`VERSION`</bdi> که در <bdi dir="ltr">`main`</bdi> <bdi dir="ltr">merge</bdi> شود، **<bdi dir="ltr">Release Kickoff</bdi>** را آغاز می‌کند. این <bdi dir="ltr">workflow parity</bdi> نسخه را بررسی می‌کند، فقط اگر <bdi dir="ltr">tag</bdi> وجود نداشته باشد آن را می‌سازد، از <bdi dir="ltr">move</bdi> یا <bdi dir="ltr">reuse</bdi> کردن <bdi dir="ltr">tag</bdi>ی که به <bdi dir="ltr">commit</bdi> دیگری اشاره دارد خودداری می‌کند و <bdi dir="ltr">production workflow</bdi> را روی همان <bdi dir="ltr">tag dispatch</bdi> می‌کند. <bdi dir="ltr">dispatch</bdi> صریح لازم است چون <bdi dir="ltr">GitHub recursion</bdi> عادی <bdi dir="ltr">workflow</bdi> را برای <bdi dir="ltr">event</bdi>های ایجادشده با <bdi dir="ltr">`GITHUB_TOKEN`</bdi> سرکوب می‌کند.

## مدل اعتماد <bdi dir="ltr">Artifact</bdi> رسمی

نصب‌کننده‌های رسمی <bdi dir="ltr">Scriptor</bdi> عمداً **بدون امضای ناشر** هستند. <bdi dir="ltr">release workflow</bdi> به <bdi dir="ltr">certificate</bdi>، <bdi dir="ltr">notarization</bdi>، <bdi dir="ltr">private key</bdi> یا <bdi dir="ltr">signing secret</bdi> وابسته نیست. بنابراین <bdi dir="ltr">Windows</bdi> و <bdi dir="ltr">macOS</bdi> ممکن است هشدار ناشر ناشناخته یا توسعه‌دهنده ناشناس نمایش دهند.

ماتریس <bdi dir="ltr">target</bdi> بالادست:

| <bdi dir="ltr">Platform</bdi> | <bdi dir="ltr">Architecture</bdi> | نوع <bdi dir="ltr">Installer</bdi> منتشرشده |
|---|---|---|
| <bdi dir="ltr">Windows</bdi> | <bdi dir="ltr">`x86_64`</bdi> | <bdi dir="ltr">MSI</bdi>, <bdi dir="ltr">NSIS EXE</bdi> |
| <bdi dir="ltr">macOS</bdi> | <bdi dir="ltr">`aarch64`</bdi> | <bdi dir="ltr">DMG</bdi> |
| <bdi dir="ltr">Linux</bdi> | <bdi dir="ltr">`x86_64`</bdi> | <bdi dir="ltr">DEB</bdi>, <bdi dir="ltr">AppImage</bdi> |
| <bdi dir="ltr">Linux</bdi> | <bdi dir="ltr">`aarch64`</bdi> | <bdi dir="ltr">DEB</bdi>, <bdi dir="ltr">AppImage</bdi> |

هر <bdi dir="ltr">packaging job</bdi> یک رکورد <bdi dir="ltr">architecture-bound</bdi> با نام <bdi dir="ltr">`signing-evidence-<platform>-<architecture>.json`</bdi> می‌نویسد. رکورد رسمی اعلام می‌کند:

- <bdi dir="ltr">`signed: false`</bdi>؛
- <bdi dir="ltr">`notarized: false`</bdi>؛
- <bdi dir="ltr">`signatureType: "none"`</bdi>؛
- <bdi dir="ltr">source</bdi> <bdi dir="ltr">commit</bdi> دقیق؛
- <bdi dir="ltr">release</bdi> <bdi dir="ltr">channel</bdi>، <bdi dir="ltr">target platform</bdi> و <bdi dir="ltr">architecture</bdi>؛
- دستور <bdi dir="ltr">verifier: checksum</bdi> + <bdi dir="ltr">GitHub attestation.</bdi>

<bdi dir="ltr">publication</bdi> <bdi dir="ltr">job</bdi> دقیقاً یک رکورد برای هر <bdi dir="ltr">target</bdi> پشتیبانی‌شده لازم دارد. رکورد <bdi dir="ltr">missing</bdi>، <bdi dir="ltr">duplicate</bdi>، <bdi dir="ltr">unexpected</bdi>، <bdi dir="ltr">wrong-channel</bdi> یا <bdi dir="ltr">wrong-commit</bdi> انتشار را متوقف می‌کند.

<bdi dir="ltr">release</bdi> <bdi dir="ltr">receipt</bdi> با <bdi dir="ltr">schema</bdi> 4، <bdi dir="ltr">target matrix</bdi> راستی‌آزمایی‌شده را کنار <bdi dir="ltr">source identity</bdi>، <bdi dir="ltr">toolchain metadata</bdi>، <bdi dir="ltr">checksum</bdi>ها و <bdi dir="ltr">exact installer subject set</bdi> قرار می‌دهد. رکورد <bdi dir="ltr">production</bdi> بدون امضا مجاز است، اما <bdi dir="ltr">trust status</bdi> گم‌شده یا با توصیف نادرست هرگز مجاز نیست.

## مرز دقیق <bdi dir="ltr">Artifact</bdi>

هر <bdi dir="ltr">packaging job</bdi> فقط <bdi dir="ltr">installer</bdi>های قابل‌توزیع و یک <bdi dir="ltr">trust-status record</bdi> وابسته به <bdi dir="ltr">architecture</bdi> را منتقل می‌کند. <bdi dir="ltr">publication</bdi> آن‌ها را جدا می‌کند:

- <bdi dir="ltr">`release-artifacts`</bdi>: دقیقاً ۷ <bdi dir="ltr">installer</bdi> — یک <bdi dir="ltr">MSI</bdi>، یک <bdi dir="ltr">NSIS EXE</bdi>، یک <bdi dir="ltr">DMG</bdi>، دو <bdi dir="ltr">DEB</bdi> و دو <bdi dir="ltr">AppImage</bdi>؛
- <bdi dir="ltr">`release-evidence`</bdi>: دقیقاً ۴ رکورد <bdi dir="ltr">JSON</bdi> وضعیت اعتماد، سپس <bdi dir="ltr">SBOM</bdi>، <bdi dir="ltr">checksum file</bdi> و <bdi dir="ltr">receipt</bdi> تولیدشده.

محتوای <bdi dir="ltr">unpacked AppDir</bdi>، فایل‌های داخلی <bdi dir="ltr">`.app`</bdi>، <bdi dir="ltr">script</bdi> کمکی <bdi dir="ltr">DMG</bdi>، <bdi dir="ltr">log</bdi>های <bdi dir="ltr">CI</bdi>، <bdi dir="ltr">cache</bdi>، <bdi dir="ltr">source map</bdi>، <bdi dir="ltr">key material</bdi> موقت و فایل دلخواه زیر <bdi dir="ltr">`target/release/bundle`</bdi> هرگز <bdi dir="ltr">release subject</bdi> نیستند.

<bdi dir="ltr">publication</bdi> فایل‌های <bdi dir="ltr">staging</bdi>شده را <bdi dir="ltr">download</bdi> می‌کند و <bdi dir="ltr">rebuild</bdi> انجام نمی‌دهد. سپس می‌سازد:

- <bdi dir="ltr">`SHA256SUMS`</bdi> فقط برای هفت <bdi dir="ltr">installer subject</bdi>؛
- <bdi dir="ltr">CycloneDX</bdi> 1.6 <bdi dir="ltr">SBOM</bdi> متصل به <bdi dir="ltr">release version</bdi> و <bdi dir="ltr">source identity</bdi>؛
- <bdi dir="ltr">source-bound</bdi> <bdi dir="ltr">release receipt schema</bdi> 4 با چهار <bdi dir="ltr">normalized trust record</bdi>؛
- <bdi dir="ltr">GitHub</bdi> <bdi dir="ltr">provenance</bdi> و <bdi dir="ltr">SBOM attestation</bdi> برای هر <bdi dir="ltr">installer subject.</bdi>

چهار <bdi dir="ltr">trust-status record</bdi> به‌عنوان <bdi dir="ltr">metadata</bdi> منتشر و در <bdi dir="ltr">receipt embed</bdi> می‌شوند، اما <bdi dir="ltr">installer subject</bdi> نیستند و در <bdi dir="ltr">`SHA256SUMS`</bdi> قرار نمی‌گیرند.

## کنترل‌های <bdi dir="ltr">Supply Chain</bdi>

- <bdi dir="ltr">action</bdi> خارجی به <bdi dir="ltr">full commit SHA</bdi> بازبینی‌شده <bdi dir="ltr">pin</bdi> می‌شود؛
- <bdi dir="ltr">runner</bdi> <bdi dir="ltr">label</bdi> ثابت و <bdi dir="ltr">version</bdi>های <bdi dir="ltr">pin</bdi>شده <bdi dir="ltr">Node</bdi>، <bdi dir="ltr">pnpm</bdi> و <bdi dir="ltr">Rust</bdi>؛
- <bdi dir="ltr">frozen</bdi> <bdi dir="ltr">pnpm dependency installation</bdi> و <bdi dir="ltr">locked Cargo resolution</bdi>؛
- نام <bdi dir="ltr">artifact</bdi> مخصوص <bdi dir="ltr">architecture</bdi> برای جلوگیری از <bdi dir="ltr">collision</bdi> میان <bdi dir="ltr">x86_64/aarch64</bdi>؛
- <bdi dir="ltr">immutable</bdi> <bdi dir="ltr">tag creation</bdi> با خودداری از <bdi dir="ltr">retarget</bdi> نسخه موجود؛
- بررسی دقیق <bdi dir="ltr">cardinality</bdi> نصب‌کننده و <bdi dir="ltr">metadata</bdi> پیش از <bdi dir="ltr">evidence generation</bdi>؛
- <bdi dir="ltr">exact</bdi> <bdi dir="ltr">subject-set verification</bdi> پیش از <bdi dir="ltr">release upload</bdi>؛
- <bdi dir="ltr">clean-checkout</bdi> <bdi dir="ltr">source identity</bdi> متصل به <bdi dir="ltr">release commit</bdi>؛
- <bdi dir="ltr">diagnostics</bdi> مربوط به <bdi dir="ltr">packaging/publication</bdi> نگه داشته می‌شود ولی با <bdi dir="ltr">release asset</bdi> مخلوط نمی‌شود.

## راستی‌آزمایی توسط مصرف‌کننده

یک <bdi dir="ltr">installer</bdi> را همراه <bdi dir="ltr">`SHA256SUMS`، `scriptor.cyclonedx.json` و `release-receipt.json`</bdi> از یک <bdi dir="ltr">GitHub Release</bdi> واحد دانلود کنید.

<bdi dir="ltr">GitHub</bdi> <bdi dir="ltr">attestation</bdi> را بررسی کنید:

</div>

<div dir="ltr">

<div dir="ltr">
```bash
gh attestation verify <installer> --repo AmirrezaFarnamTaheri/Scriptor
```
</div>

</div>

<div dir="rtl" lang="fa">

برای یک <bdi dir="ltr">installer</bdi> دانلودشده در <bdi dir="ltr">Linux checksum</bdi> را بررسی کنید:

</div>

<div dir="ltr">

<div dir="ltr">
```bash
artifact="scriptor-<version>-linux-x86_64.AppImage"
grep -F "  $artifact" SHA256SUMS | sha256sum --check -
```
</div>

</div>

<div dir="rtl" lang="fa">

بررسی <bdi dir="ltr">checksum</bdi> در <bdi dir="ltr">macOS:</bdi>

</div>

<div dir="ltr">

<div dir="ltr">
```bash
artifact="scriptor-<version>-macos-aarch64.dmg"
expected=$(awk -v name="$artifact" '$2 == name { print $1 }' SHA256SUMS)
actual=$(shasum -a 256 "$artifact" | awk '{ print $1 }')
test -n "$expected" && test "$actual" = "$expected"
```
</div>

</div>

<div dir="rtl" lang="fa">

بررسی <bdi dir="ltr">checksum</bdi> در <bdi dir="ltr">Windows PowerShell:</bdi>

</div>

<div dir="ltr">

<div dir="ltr">
```powershell
$artifact = 'scriptor-<version>-windows-x86_64-setup.exe'
$line = Get-Content .\SHA256SUMS | Where-Object { $_ -match "  $([regex]::Escape($artifact))$" }
if (-not $line) { throw 'Installer is not listed in SHA256SUMS.' }
$expected = ($line -split '\s+', 2)[0].ToLowerInvariant()
$actual = (Get-FileHash ".\$artifact" -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actual -ne $expected) { throw 'Checksum verification failed.' }
```
</div>

</div>

<div dir="rtl" lang="fa">

<bdi dir="ltr">maintainer</bdi> همچنین می‌تواند هر هفت <bdi dir="ltr">installer</bdi> را در <bdi dir="ltr">`release-artifacts`</bdi> دانلود کند، چهار <bdi dir="ltr">trust record</bdi> به‌همراه <bdi dir="ltr">SBOM/checksum/receipt</bdi> را در <bdi dir="ltr">`release-evidence`</bdi> بگذارد، <bdi dir="ltr">tag</bdi> دقیق را <bdi dir="ltr">checkout</bdi> کند و اجرا کند:

</div>

<div dir="ltr">

<div dir="ltr">
```bash
node scripts/release/verify-signing-evidence.mjs release-evidence production
node scripts/release/verify-release-evidence.mjs release-artifacts release-evidence
```
</div>

</div>

<div dir="rtl" lang="fa">

هر <bdi dir="ltr">checksum</bdi>، <bdi dir="ltr">SBOM</bdi>، <bdi dir="ltr">receipt</bdi>، <bdi dir="ltr">target-status record</bdi>، <bdi dir="ltr">source identity</bdi>، <bdi dir="ltr">exact-subject match</bdi> یا <bdi dir="ltr">GitHub attestation</bdi> گم‌شده یا نامعتبر، <bdi dir="ltr">production release</bdi> را <bdi dir="ltr">block</bdi> می‌کند. برای <bdi dir="ltr">installer</bdi>های رسمی <bdi dir="ltr">upstream</bdi> هیچ <bdi dir="ltr">OS publisher signature</bdi> ادعا نمی‌شود.

</div>


</div>
