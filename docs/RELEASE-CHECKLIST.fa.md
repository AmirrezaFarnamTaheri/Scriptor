<div dir="ltr" align="center">
[English](RELEASE-CHECKLIST.md) · **فارسی** · [简体中文](RELEASE-CHECKLIST.zh-CN.md) · [Русский](RELEASE-CHECKLIST.ru.md) · [Deutsch](RELEASE-CHECKLIST.de.md) · [Español](RELEASE-CHECKLIST.es.md)
</div>

<div dir="rtl" lang="fa" align="right">

<div dir="rtl" lang="fa">

# چک‌لیست <bdi dir="ltr">Release</bdi> تولیدی

[<bdi dir="ltr">English</bdi>](RELEASE-CHECKLIST.md) · [简体中文](RELEASE-CHECKLIST.zh-CN.md) · [Русский](RELEASE-CHECKLIST.ru.md) · [<bdi dir="ltr">Deutsch</bdi>](RELEASE-CHECKLIST.de.md) · [<bdi dir="ltr">Espa</bdi>ñ<bdi dir="ltr">ol</bdi>](RELEASE-CHECKLIST.es.md) · **فارسی**

پیش از تأیید <bdi dir="ltr">release</bdi>، <bdi dir="ltr">baseline</bdi>های <bdi dir="ltr">visual capture</bdi> باید <bdi dir="ltr">review</bdi> شوند. گالری مرجع در [`README.md`](../README.md) اصلی است؛ <bdi dir="ltr">inventory</bdi> کامل <bdi dir="ltr">capture</bdi>های بررسی‌شده، یادداشت <bdi dir="ltr">reviewer</bdi> و <bdi dir="ltr">workflow</bdi> بازتولید در [`assets/screenshots/README.md`](assets/screenshots/README.md) و قواعد <bdi dir="ltr">review</bdi> و <bdi dir="ltr">coverage</bdi> مجموعه آزمون در [`VISUAL-REVIEW.md`](VISUAL-REVIEW.md) قرار دارد.

<bdi dir="ltr">Production</bdi> <bdi dir="ltr">release</bdi> تا زمانی که همه موارد ضروری روی <bdi dir="ltr">tag</bdi> دقیق و <bdi dir="ltr">bytes</bdi> دقیق <bdi dir="ltr">artifact</bdi> بررسی نشده باشند <bdi dir="ltr">blocked</bdi> است.

## شرایط توقف <bdi dir="ltr">Promotion</bdi>

- [ ] اگر هر مورد ضروری <bdi dir="ltr">pending</bdi>، <bdi dir="ltr">failed</bdi> یا <bdi dir="ltr">skipped</bdi> است یا <bdi dir="ltr">evidence</bdi> به <bdi dir="ltr">source tree</bdi> دیگری مربوط می‌شود، توقف؛
- [ ] اگر <bdi dir="ltr">installer subject set</bdi> حتی یک فایل با <bdi dir="ltr">receipt</bdi> فرق دارد، توقف؛
- [ ] اگر <bdi dir="ltr">target</bdi> گم‌شده، <bdi dir="ltr">duplicate</bdi>، <bdi dir="ltr">unexpected</bdi> یا <bdi dir="ltr">mislabeled</bdi> است، توقف؛
- [ ] اگر <bdi dir="ltr">initial editor chunk</bdi> وارد <bdi dir="ltr">eager bundle graph</bdi> شود یا <bdi dir="ltr">gzip budget regress</bdi> کند، توقف؛
- [ ] اگر <bdi dir="ltr">cancel/failure</bdi> عملیات <bdi dir="ltr">destructive</bdi> باعث <bdi dir="ltr">divergence</bdi> میان <bdi dir="ltr">disk</bdi>، <bdi dir="ltr">tabs</bdi>، <bdi dir="ltr">index</bdi> یا <bdi dir="ltr">vault state</bdi> شود، توقف؛
- [ ] اگر <bdi dir="ltr">process launch</bdi> فاقد <bdi dir="ltr">live per-call inventory entry</bdi> باشد یا <bdi dir="ltr">review</bdi> آن <bdi dir="ltr">expire</bdi> شده باشد، توقف؛
- [ ] اگر <bdi dir="ltr">rollback</bdi>، <bdi dir="ltr">restore</bdi>، <bdi dir="ltr">trust status</bdi> یا <bdi dir="ltr">observability</bdi> روی <bdi dir="ltr">target platform</bdi> قابل اثبات نباشد، توقف؛
- [ ] اگر <bdi dir="ltr">RustSec exception review</bdi> منقضی یا فاقد <bdi dir="ltr">owner/exit condition</bdi> باشد، توقف؛
- [ ] اگر <bdi dir="ltr">Playwright E2E</bdi> یا <bdi dir="ltr">visual regression</bdi> در <bdi dir="ltr">exact-head CI matrix skip</bdi> یا <bdi dir="ltr">missing</bdi> باشد، توقف؛
- [ ] اگر <bdi dir="ltr">protected release environment</bdi> وجود نداشته باشد، <bdi dir="ltr">required reviewer</bdi> نداشته باشد یا <bdi dir="ltr">production publish job</bdi> را <bdi dir="ltr">gate</bdi> نکند، توقف؛
- [ ] اگر <bdi dir="ltr">vault content</bdi> منتشرشده نیاز به <bdi dir="ltr">review</bdi> دارد ولی <bdi dir="ltr">GitHub Pages</bdi> فاقد <bdi dir="ltr">environment</bdi> جداگانه تأییدشده <bdi dir="ltr">`github-pages`</bdi> باشد، توقف.

## <bdi dir="ltr">Source freeze</bdi>

- [ ] <bdi dir="ltr">canonical working tree clean</bdi>؛
- [ ] <bdi dir="ltr">metadata</bdi> مربوط به <bdi dir="ltr">npm</bdi>، <bdi dir="ltr">Cargo</bdi>، <bdi dir="ltr">Tauri</bdi> و <bdi dir="ltr">lockfile sync</bdi> و مطابق <bdi dir="ltr">`VERSION`</bdi>؛
- [ ] <bdi dir="ltr">tag</bdi> بازبینی‌شده <bdi dir="ltr">`v<version>`</bdi> مطابق <bdi dir="ltr">`VERSION`</bdi> و <bdi dir="ltr">release commit</bdi> دقیق؛
- [ ] <bdi dir="ltr">version tag</bdi> موجود هرگز <bdi dir="ltr">move/reuse</bdi> نشود؛
- [ ] <bdi dir="ltr">`pnpm check:governance`</bdi> <bdi dir="ltr">pass</bdi>؛
- [ ] <bdi dir="ltr">`pnpm check:source`</bdi> <bdi dir="ltr">pass</bdi>؛
- [ ] <bdi dir="ltr">validation</bdi>، <bdi dir="ltr">lockfile</bdi> را تغییر ندهد؛
- [ ] <bdi dir="ltr">full history/secret/provenance audit</bdi> با <bdi dir="ltr">tag reconcile</bdi> شود؛
- [ ] <bdi dir="ltr">workflow</bdi> بدون انتشار **<bdi dir="ltr">Release Binary Review</bdi>** برای <bdi dir="ltr">candidate</bdi> دقیق <bdi dir="ltr">pass</bdi> و <bdi dir="ltr">CLI/daemon binary manifest</bdi> نگه‌داری شود.

## راستی‌آزمایی مهندسی

- [ ] <bdi dir="ltr">frozen pnpm install</bdi> موفق؛
- [ ] <bdi dir="ltr">lint</bdi>، <bdi dir="ltr">TypeScript build</bdi>، <bdi dir="ltr">package contract runners</bdi> و <bdi dir="ltr">unit/integration tests pass</bdi>؛
- [ ] <bdi dir="ltr">Cargo fmt</bdi>، <bdi dir="ltr">Clippy</bdi>، <bdi dir="ltr">tests</bdi> و <bdi dir="ltr">cargo-deny</bdi> در <bdi dir="ltr">product/incubating profile pass</bdi>؛
- [ ] <bdi dir="ltr">daemon</bdi>، <bdi dir="ltr">CLI/TUI</bdi>، <bdi dir="ltr">container</bdi>، <bdi dir="ltr">E2E</bdi>، <bdi dir="ltr">visual</bdi>، <bdi dir="ltr">axe</bdi> و <bdi dir="ltr">performance gates pass</bdi>؛
- [ ] هیچ <bdi dir="ltr">skipped/flaky test</bdi> بی‌صدا پذیرفته نشود.

## امنیت و تمامیت داده

- [ ] هر <bdi dir="ltr">native command</bdi> جدید <bdi dir="ltr">classify</bdi> و <bdi dir="ltr">authorization-inventoried</bdi> شود؛
- [ ] <bdi dir="ltr">remote fallback</bdi>، <bdi dir="ltr">generic secret API</bdi>، <bdi dir="ltr">shell string</bdi>، <bdi dir="ltr">unbounded queue/log/output</bdi> یا <bdi dir="ltr">unchecked boundary assertion</bdi> جدید وجود نداشته باشد؛
- [ ] <bdi dir="ltr">release workflow</bdi> به <bdi dir="ltr">certificate</bdi>، <bdi dir="ltr">notarization</bdi>، <bdi dir="ltr">private key</bdi> یا <bdi dir="ltr">signing secret</bdi> وابسته نباشد؛
- [ ] <bdi dir="ltr">release notes</bdi> رسمی <bdi dir="ltr">unsigned</bdi> بودن <bdi dir="ltr">installer</bdi>ها را صریح اعلام کند؛
- [ ] <bdi dir="ltr">backup creation</bdi>، <bdi dir="ltr">corruption rejection</bdi>، <bdi dir="ltr">interrupted restore</bdi> و <bdi dir="ltr">successful restore drill</bdi> شوند؛
- [ ] <bdi dir="ltr">MCP interrupted-mutation reconciliation</bdi> و <bdi dir="ltr">audit integrity drill</bdi> شوند؛
- [ ] <bdi dir="ltr">privacy/diagnostic output redacted</bdi> و <bdi dir="ltr">bounded</bdi> باشد.

## کیفیت <bdi dir="ltr">UI</bdi>

- [ ] <bdi dir="ltr">screenshot</bdi>ها برای همه <bdi dir="ltr">breakpoint/theme</bdi>های لازم <bdi dir="ltr">regenerate</bdi> و <bdi dir="ltr">review</bdi> شوند؛
- [ ] <bdi dir="ltr">console error</bdi> یا <bdi dir="ltr">failed network resource</bdi> وجود نداشته باشد؛
- [ ] <bdi dir="ltr">keyboard/focus order</bdi> برای هر <bdi dir="ltr">modal</bdi>، <bdi dir="ltr">composite tab control</bdi> و <bdi dir="ltr">toolbar popover pass</bdi>؛
- [ ] <bdi dir="ltr">menu</bdi>های <bdi dir="ltr">Typography</bdi> و <bdi dir="ltr">Insert</bdi> در <bdi dir="ltr">body portal</bdi> خارج از <bdi dir="ltr">scroll-clipping ancestor render</bdi> شوند، داخل <bdi dir="ltr">viewport</bdi> بمانند، با <bdi dir="ltr">Escape/Tab/outside click</bdi> بسته شوند و پس از <bdi dir="ltr">Escape focus</bdi> را <bdi dir="ltr">restore</bdi> کنند؛
- [ ] <bdi dir="ltr">positioning</bdi> مربوط به <bdi dir="ltr">toolbar popover</bdi> باعث <bdi dir="ltr">React render loop</bdi> اضافی نشود؛
- [ ] <bdi dir="ltr">axe</bdi> هیچ <bdi dir="ltr">critical/serious violation</bdi> نداشته باشد؛
- [ ] <bdi dir="ltr">screen reader</bdi>، 200% <bdi dir="ltr">zoom</bdi>، <bdi dir="ltr">reduced motion</bdi> و <bdi dir="ltr">high contrast spot check pass</bdi>؛
- [ ] <bdi dir="ltr">state</bdi>های <bdi dir="ltr">empty/loading/error/success/destructive</bdi> بصری <bdi dir="ltr">review</bdi> شوند.

## تولید <bdi dir="ltr">Artifact</bdi>

- [ ] فقط یک <bdi dir="ltr">build</bdi> از <bdi dir="ltr">frozen tag</bdi>؛
- [ ] <bdi dir="ltr">Windows x86_64</bdi> دقیقاً یک <bdi dir="ltr">MSI</bdi> + یک <bdi dir="ltr">NSIS EXE</bdi>؛
- [ ] <bdi dir="ltr">macOS aarch64</bdi> دقیقاً یک <bdi dir="ltr">DMG</bdi>؛
- [ ] <bdi dir="ltr">Linux x86_64</bdi> دقیقاً یک <bdi dir="ltr">DEB</bdi> + یک <bdi dir="ltr">AppImage</bdi>؛
- [ ] <bdi dir="ltr">Linux aarch64</bdi> دقیقاً یک <bdi dir="ltr">DEB</bdi> + یک <bdi dir="ltr">AppImage</bdi>؛
- [ ] هر <bdi dir="ltr">target</bdi> یک <bdi dir="ltr">`signing-evidence-<platform>-<architecture>.json`</bdi> بنویسد؛
- [ ] <bdi dir="ltr">official target record</bdi>ها <bdi dir="ltr">`signed: false`، `notarized: false`، `signatureType: "none"`</bdi> گزارش کنند؛
- [ ] <bdi dir="ltr">artifact name</bdi> شامل <bdi dir="ltr">version/platform/architecture</bdi> و بدون <bdi dir="ltr">collision</bdi>؛
- [ ] هر <bdi dir="ltr">transport artifact</bdi> فقط <bdi dir="ltr">installer</bdi> + <bdi dir="ltr">target-status record</bdi>؛
- [ ] <bdi dir="ltr">publication</bdi> دقیقاً ۷ <bdi dir="ltr">installer</bdi> را در <bdi dir="ltr">`release-artifacts`</bdi> و ۴ <bdi dir="ltr">trust record</bdi> را در <bdi dir="ltr">`release-evidence`</bdi> جدا کند؛
- [ ] <bdi dir="ltr">unpacked AppDir</bdi>، <bdi dir="ltr">internals</bdi> فایل <bdi dir="ltr">`.app`</bdi>، <bdi dir="ltr">DMG helper script</bdi>، <bdi dir="ltr">log</bdi>، <bdi dir="ltr">cache</bdi>، <bdi dir="ltr">source map</bdi> و <bdi dir="ltr">development file</bdi> وجود نداشته باشد؛
- [ ] <bdi dir="ltr">clean install</bdi> + <bdi dir="ltr">smoke test</bdi> روی هر <bdi dir="ltr">target pass.</bdi>

## <bdi dir="ltr">Provenance</bdi> و <bdi dir="ltr">Publication</bdi>

- [ ] <bdi dir="ltr">workflow</bdi> اصلی **<bdi dir="ltr">Release</bdi>** تنها <bdi dir="ltr">GitHub Release owner</bdi> باشد؛
- [ ] <bdi dir="ltr">preview dispatch</bdi> چیزی <bdi dir="ltr">publish</bdi> نکند؛
- [ ] <bdi dir="ltr">production dispatch</bdi> به <bdi dir="ltr">immutable tag</bdi> موجود <bdi dir="ltr">`v*`</bdi> متصل باشد؛
- [ ] <bdi dir="ltr">`SHA256SUMS`</bdi> فقط برای هفت <bdi dir="ltr">installer subject</bdi> ساخته شود؛
- [ ] <bdi dir="ltr">CycloneDX</bdi> 1.6 <bdi dir="ltr">SBOM</bdi> متصل به <bdi dir="ltr">release source identity</bdi> تولید شود؛
- [ ] <bdi dir="ltr">release receipt schema</bdi> 4 با <bdi dir="ltr">installer hash</bdi> و چهار <bdi dir="ltr">architecture-bound trust record</bdi> تولید شود؛
- [ ] <bdi dir="ltr">receipt</bdi>، <bdi dir="ltr">checksum</bdi>، <bdi dir="ltr">SBOM</bdi>، <bdi dir="ltr">source identity</bdi>، <bdi dir="ltr">trust metadata</bdi> و <bdi dir="ltr">exact installer membership</bdi> پیش از <bdi dir="ltr">upload verify</bdi> شوند؛
- [ ] <bdi dir="ltr">GitHub provenance</bdi> و <bdi dir="ltr">SBOM attestation</bdi> برای هر <bdi dir="ltr">installer subject</bdi> ساخته شود؛
- [ ] <bdi dir="ltr">exact downloaded installer</bdi> و <bdi dir="ltr">generated evidence</bdi> بدون <bdi dir="ltr">rebuild publish</bdi> شوند؛
- [ ] دستورهای <bdi dir="ltr">single-installer</bdi> در <bdi dir="ltr">`RELEASE-SECURITY.md`</bdi> با <bdi dir="ltr">published assets verify</bdi> شوند؛
- [ ] <bdi dir="ltr">release notes</bdi> شامل <bdi dir="ltr">unknown-publisher guidance</bdi> و <bdi dir="ltr">checksum/attestation commands</bdi> باشد؛
- [ ] <bdi dir="ltr">changelog</bdi>، <bdi dir="ltr">capability ledger</bdi>، <bdi dir="ltr">support window</bdi> و <bdi dir="ltr">known limitations update</bdi> شوند.

</div>


</div>
