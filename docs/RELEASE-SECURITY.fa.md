<div dir="rtl" lang="fa">

# امنیت و راستی‌آزمایی Release

[English](RELEASE-SECURITY.md) · [简体中文](RELEASE-SECURITY.zh-CN.md) · [Русский](RELEASE-SECURITY.ru.md) · [Deutsch](RELEASE-SECURITY.de.md) · [Español](RELEASE-SECURITY.es.md) · **فارسی**

## مرجع نسخه

فایل <bdi dir="ltr">`VERSION`</bdi> مرجع قطعی است. فرمان <bdi dir="ltr">`node scripts/release/version.mjs check`</bdi> وقتی npm package، Cargo package، Tauri config، release version صریح یا release tag با آن اختلاف داشته باشد fail می‌شود. branch refهایی که tag نیستند به‌عنوان version تفسیر نمی‌شوند. <bdi dir="ltr">`node scripts/release/version.mjs sync`</bdi> فقط در branch تغییر نسخه که review شده استفاده می‌شود؛ lockfileها پیش از merge دوباره تولید و بررسی می‌شوند.

## کانال‌ها و مالکیت Release

- **Preview:** اجرای دستی با <bdi dir="ltr">`publish: false`</bdi>. نسخه از <bdi dir="ltr">`VERSION`</bdi> مرجع checkoutشده به دست می‌آید، workflow artifact آپلود می‌شود و هیچ GitHub Release ساخته نمی‌شود.
- **Production:** tag غیرقابل‌تغییر <bdi dir="ltr">`v<version>`</bdi> که مقدارش با <bdi dir="ltr">`VERSION`</bdi> یکی است. فقط workflow اصلی **Release** مجاز به ساخت یا تغییر GitHub Release است.

تغییر <bdi dir="ltr">`VERSION`</bdi> که در <bdi dir="ltr">`main`</bdi> merge شود، **Release Kickoff** را آغاز می‌کند. این workflow parity نسخه را بررسی می‌کند، فقط اگر tag وجود نداشته باشد آن را می‌سازد، از move یا reuse کردن tagی که به commit دیگری اشاره دارد خودداری می‌کند و production workflow را روی همان tag dispatch می‌کند. dispatch صریح لازم است چون GitHub recursion عادی workflow را برای eventهای ایجادشده با <bdi dir="ltr">`GITHUB_TOKEN`</bdi> سرکوب می‌کند.

## مدل اعتماد Artifact رسمی

نصب‌کننده‌های رسمی Scriptor عمداً **بدون امضای ناشر** هستند. release workflow به certificate، notarization، private key یا signing secret وابسته نیست. بنابراین Windows و macOS ممکن است هشدار ناشر ناشناخته یا توسعه‌دهنده ناشناس نمایش دهند.

ماتریس target بالادست:

| Platform | Architecture | نوع Installer منتشرشده |
|---|---|---|
| Windows | <bdi dir="ltr">`x86_64`</bdi> | MSI, NSIS EXE |
| macOS | <bdi dir="ltr">`aarch64`</bdi> | DMG |
| Linux | <bdi dir="ltr">`x86_64`</bdi> | DEB, AppImage |
| Linux | <bdi dir="ltr">`aarch64`</bdi> | DEB, AppImage |

هر packaging job یک رکورد architecture-bound با نام <bdi dir="ltr">`signing-evidence-<platform>-<architecture>.json`</bdi> می‌نویسد. رکورد رسمی اعلام می‌کند:

- <bdi dir="ltr">`signed: false`</bdi>؛
- <bdi dir="ltr">`notarized: false`</bdi>؛
- <bdi dir="ltr">`signatureType: "none"`</bdi>؛
- source commit دقیق؛
- release channel، target platform و architecture؛
- دستور verifier: checksum + GitHub attestation.

publication job دقیقاً یک رکورد برای هر target پشتیبانی‌شده لازم دارد. رکورد missing، duplicate، unexpected، wrong-channel یا wrong-commit انتشار را متوقف می‌کند.

release receipt با schema 4، target matrix راستی‌آزمایی‌شده را کنار source identity، toolchain metadata، checksumها و exact installer subject set قرار می‌دهد. رکورد production بدون امضا مجاز است، اما trust status گم‌شده یا با توصیف نادرست هرگز مجاز نیست.

## مرز دقیق Artifact

هر packaging job فقط installerهای قابل‌توزیع و یک trust-status record وابسته به architecture را منتقل می‌کند. publication آن‌ها را جدا می‌کند:

- <bdi dir="ltr">`release-artifacts`</bdi>: دقیقاً ۷ installer — یک MSI، یک NSIS EXE، یک DMG، دو DEB و دو AppImage؛
- <bdi dir="ltr">`release-evidence`</bdi>: دقیقاً ۴ رکورد JSON وضعیت اعتماد، سپس SBOM، checksum file و receipt تولیدشده.

محتوای unpacked AppDir، فایل‌های داخلی <bdi dir="ltr">`.app`</bdi>، script کمکی DMG، logهای CI، cache، source map، key material موقت و فایل دلخواه زیر <bdi dir="ltr">`target/release/bundle`</bdi> هرگز release subject نیستند.

publication فایل‌های stagingشده را download می‌کند و rebuild انجام نمی‌دهد. سپس می‌سازد:

- <bdi dir="ltr">`SHA256SUMS`</bdi> فقط برای هفت installer subject؛
- CycloneDX 1.6 SBOM متصل به release version و source identity؛
- source-bound release receipt schema 4 با چهار normalized trust record؛
- GitHub provenance و SBOM attestation برای هر installer subject.

چهار trust-status record به‌عنوان metadata منتشر و در receipt embed می‌شوند، اما installer subject نیستند و در <bdi dir="ltr">`SHA256SUMS`</bdi> قرار نمی‌گیرند.

## کنترل‌های Supply Chain

- action خارجی به full commit SHA بازبینی‌شده pin می‌شود؛
- runner label ثابت و versionهای pinشده Node، pnpm و Rust؛
- frozen pnpm dependency installation و locked Cargo resolution؛
- نام artifact مخصوص architecture برای جلوگیری از collision میان x86_64/aarch64؛
- immutable tag creation با خودداری از retarget نسخه موجود؛
- بررسی دقیق cardinality نصب‌کننده و metadata پیش از evidence generation؛
- exact subject-set verification پیش از release upload؛
- clean-checkout source identity متصل به release commit؛
- diagnostics مربوط به packaging/publication نگه داشته می‌شود ولی با release asset مخلوط نمی‌شود.

## راستی‌آزمایی توسط مصرف‌کننده

یک installer را همراه <bdi dir="ltr">`SHA256SUMS`، `scriptor.cyclonedx.json` و `release-receipt.json`</bdi> از یک GitHub Release واحد دانلود کنید.

GitHub attestation را بررسی کنید:

</div>

<div dir="ltr">

```bash
gh attestation verify <installer> --repo AmirrezaFarnamTaheri/Scriptor
```

</div>

<div dir="rtl" lang="fa">

برای یک installer دانلودشده در Linux checksum را بررسی کنید:

</div>

<div dir="ltr">

```bash
artifact="scriptor-<version>-linux-x86_64.AppImage"
grep -F "  $artifact" SHA256SUMS | sha256sum --check -
```

</div>

<div dir="rtl" lang="fa">

بررسی checksum در macOS:

</div>

<div dir="ltr">

```bash
artifact="scriptor-<version>-macos-aarch64.dmg"
expected=$(awk -v name="$artifact" '$2 == name { print $1 }' SHA256SUMS)
actual=$(shasum -a 256 "$artifact" | awk '{ print $1 }')
test -n "$expected" && test "$actual" = "$expected"
```

</div>

<div dir="rtl" lang="fa">

بررسی checksum در Windows PowerShell:

</div>

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

<div dir="rtl" lang="fa">

maintainer همچنین می‌تواند هر هفت installer را در <bdi dir="ltr">`release-artifacts`</bdi> دانلود کند، چهار trust record به‌همراه SBOM/checksum/receipt را در <bdi dir="ltr">`release-evidence`</bdi> بگذارد، tag دقیق را checkout کند و اجرا کند:

</div>

<div dir="ltr">

```bash
node scripts/release/verify-signing-evidence.mjs release-evidence production
node scripts/release/verify-release-evidence.mjs release-artifacts release-evidence
```

</div>

<div dir="rtl" lang="fa">

هر checksum، SBOM، receipt، target-status record، source identity، exact-subject match یا GitHub attestation گم‌شده یا نامعتبر، production release را block می‌کند. برای installerهای رسمی upstream هیچ OS publisher signature ادعا نمی‌شود.

</div>
