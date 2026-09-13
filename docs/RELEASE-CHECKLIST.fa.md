<div dir="ltr" align="center">
[English](RELEASE-CHECKLIST.md) · **فارسی** · [简体中文](RELEASE-CHECKLIST.zh-CN.md) · [Русский](RELEASE-CHECKLIST.ru.md) · [Deutsch](RELEASE-CHECKLIST.de.md) · [Español](RELEASE-CHECKLIST.es.md)
</div>

<div dir="rtl" lang="fa" align="right">

<div dir="rtl" lang="fa">

# چک‌لیست Release تولیدی

[English](RELEASE-CHECKLIST.md) · [简体中文](RELEASE-CHECKLIST.zh-CN.md) · [Русский](RELEASE-CHECKLIST.ru.md) · [Deutsch](RELEASE-CHECKLIST.de.md) · [Español](RELEASE-CHECKLIST.es.md) · **فارسی**

پیش از تأیید release، baselineهای visual capture باید review شوند. گالری مرجع در [`README.md`](../README.md) اصلی است؛ inventory کامل captureهای بررسی‌شده، یادداشت reviewer و workflow بازتولید در [`assets/screenshots/README.md`](assets/screenshots/README.md) و قواعد review و coverage مجموعه آزمون در [`VISUAL-REVIEW.md`](VISUAL-REVIEW.md) قرار دارد.

<bdi dir="ltr">Production</bdi> release تا زمانی که همه موارد ضروری روی tag دقیق و bytes دقیق artifact بررسی نشده باشند blocked است.

## شرایط توقف Promotion

- [ ] اگر هر مورد ضروری pending، failed یا skipped است یا evidence به source tree دیگری مربوط می‌شود، توقف؛
- [ ] اگر installer subject set حتی یک فایل با receipt فرق دارد، توقف؛
- [ ] اگر target گم‌شده، duplicate، unexpected یا mislabeled است، توقف؛
- [ ] اگر initial editor chunk وارد eager bundle graph شود یا gzip budget regress کند، توقف؛
- [ ] اگر cancel/failure عملیات destructive باعث divergence میان disk، tabs، index یا vault state شود، توقف؛
- [ ] اگر process launch فاقد live per-call inventory entry باشد یا review آن expire شده باشد، توقف؛
- [ ] اگر rollback، restore، trust status یا observability روی target platform قابل اثبات نباشد، توقف؛
- [ ] اگر RustSec exception review منقضی یا فاقد owner/exit condition باشد، توقف؛
- [ ] اگر Playwright E2E یا visual regression در exact-head CI matrix skip یا missing باشد، توقف؛
- [ ] اگر protected release environment وجود نداشته باشد، required reviewer نداشته باشد یا production publish job را gate نکند، توقف؛
- [ ] اگر vault content منتشرشده نیاز به review دارد ولی GitHub Pages فاقد environment جداگانه تأییدشده <bdi dir="ltr">`github-pages`</bdi> باشد، توقف.

## Source freeze

- [ ] canonical working tree clean؛
- [ ] metadata مربوط به npm، Cargo، Tauri و lockfile sync و مطابق <bdi dir="ltr">`VERSION`</bdi>؛
- [ ] tag بازبینی‌شده <bdi dir="ltr">`v<version>`</bdi> مطابق <bdi dir="ltr">`VERSION`</bdi> و release commit دقیق؛
- [ ] version tag موجود هرگز move/reuse نشود؛
- [ ] <bdi dir="ltr">`pnpm check:governance`</bdi> pass؛
- [ ] <bdi dir="ltr">`pnpm check:source`</bdi> pass؛
- [ ] validation، lockfile را تغییر ندهد؛
- [ ] full history/secret/provenance audit با tag reconcile شود؛
- [ ] workflow بدون انتشار **Release Binary Review** برای candidate دقیق pass و CLI/daemon binary manifest نگه‌داری شود.

## راستی‌آزمایی مهندسی

- [ ] frozen pnpm install موفق؛
- [ ] lint، TypeScript build، package contract runners و unit/integration tests pass؛
- [ ] Cargo fmt، Clippy، tests و cargo-deny در product/incubating profile pass؛
- [ ] daemon، CLI/TUI، container، E2E، visual، axe و performance gates pass؛
- [ ] هیچ skipped/flaky test بی‌صدا پذیرفته نشود.

## امنیت و تمامیت داده

- [ ] هر native command جدید classify و authorization-inventoried شود؛
- [ ] remote fallback، generic secret API، shell string، unbounded queue/log/output یا unchecked boundary assertion جدید وجود نداشته باشد؛
- [ ] release workflow به certificate، notarization، private key یا signing secret وابسته نباشد؛
- [ ] release notes رسمی unsigned بودن installerها را صریح اعلام کند؛
- [ ] backup creation، corruption rejection، interrupted restore و successful restore drill شوند؛
- [ ] MCP interrupted-mutation reconciliation و audit integrity drill شوند؛
- [ ] privacy/diagnostic output redacted و bounded باشد.

## کیفیت UI

- [ ] screenshotها برای همه breakpoint/themeهای لازم regenerate و review شوند؛
- [ ] console error یا failed network resource وجود نداشته باشد؛
- [ ] keyboard/focus order برای هر modal، composite tab control و toolbar popover pass؛
- [ ] menuهای Typography و Insert در body portal خارج از scroll-clipping ancestor render شوند، داخل viewport بمانند، با Escape/Tab/outside click بسته شوند و پس از Escape focus را restore کنند؛
- [ ] positioning مربوط به toolbar popover باعث React render loop اضافی نشود؛
- [ ] axe هیچ critical/serious violation نداشته باشد؛
- [ ] screen reader، 200% zoom، reduced motion و high contrast spot check pass؛
- [ ] stateهای empty/loading/error/success/destructive بصری review شوند.

## تولید Artifact

- [ ] فقط یک build از frozen tag؛
- [ ] Windows x86_64 دقیقاً یک MSI + یک NSIS EXE؛
- [ ] macOS aarch64 دقیقاً یک DMG؛
- [ ] Linux x86_64 دقیقاً یک DEB + یک AppImage؛
- [ ] Linux aarch64 دقیقاً یک DEB + یک AppImage؛
- [ ] هر target یک <bdi dir="ltr">`signing-evidence-<platform>-<architecture>.json`</bdi> بنویسد؛
- [ ] official target recordها <bdi dir="ltr">`signed: false`، `notarized: false`، `signatureType: "none"`</bdi> گزارش کنند؛
- [ ] artifact name شامل version/platform/architecture و بدون collision؛
- [ ] هر transport artifact فقط installer + target-status record؛
- [ ] publication دقیقاً ۷ installer را در <bdi dir="ltr">`release-artifacts`</bdi> و ۴ trust record را در <bdi dir="ltr">`release-evidence`</bdi> جدا کند؛
- [ ] unpacked AppDir، internals فایل <bdi dir="ltr">`.app`</bdi>، DMG helper script، log، cache، source map و development file وجود نداشته باشد؛
- [ ] clean install + smoke test روی هر target pass.

## Provenance و Publication

- [ ] workflow اصلی **Release** تنها GitHub Release owner باشد؛
- [ ] preview dispatch چیزی publish نکند؛
- [ ] production dispatch به immutable tag موجود <bdi dir="ltr">`v*`</bdi> متصل باشد؛
- [ ] <bdi dir="ltr">`SHA256SUMS`</bdi> فقط برای هفت installer subject ساخته شود؛
- [ ] CycloneDX 1.6 SBOM متصل به release source identity تولید شود؛
- [ ] release receipt schema 4 با installer hash و چهار architecture-bound trust record تولید شود؛
- [ ] receipt، checksum، SBOM، source identity، trust metadata و exact installer membership پیش از upload verify شوند؛
- [ ] GitHub provenance و SBOM attestation برای هر installer subject ساخته شود؛
- [ ] exact downloaded installer و generated evidence بدون rebuild publish شوند؛
- [ ] دستورهای single-installer در <bdi dir="ltr">`RELEASE-SECURITY.md`</bdi> با published assets verify شوند؛
- [ ] release notes شامل unknown-publisher guidance و checksum/attestation commands باشد؛
- [ ] changelog، capability ledger، support window و known limitations update شوند.

</div>


</div>
