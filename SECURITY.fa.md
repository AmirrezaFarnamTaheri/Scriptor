# سیاست امنیت

## گزارش آسیب‌پذیری

برای آسیب‌پذیری مشکوک issue عمومی باز نکنید. به **taherifarnam@gmail.com** ایمیل بزنید و این موارد را بفرستید:

- نسخه/commit تحت تأثیر؛
- محیط و پیش‌نیازها؛
- مراحل قابل بازتولید یا proof of concept؛
- اثر و مرز داده/اختیاری که عبور شده است؛
- نیازهای پیشنهادی embargo یا هماهنگی.

<bdi dir="ltr">secret</bdi> واقعی یا داده شخصی شخص ثالث را وارد نکنید. گزارش‌ها در اولین زمان عملی تأیید دریافت می‌شوند؛ زمان disclosure پس از روشن شدن اثر و remediation هماهنگ می‌شود.

## نسخه پشتیبانی‌شده

فقط release tagشده فعلی و branch فعلی `main` اصلاحات امنیتی دریافت می‌کنند. هویت release از [`VERSION`](VERSION) می‌آید.

## مرزهای اعتماد

- **Renderer:** نسبت به اختیار native filesystem، keychain، process، backup، Git، network و publish غیرقابل اعتماد فرض می‌شود.
- **Tauri commands:** بر اساس نوع عملیات طبقه‌بندی می‌شوند؛ commandهای حساس به grant یک‌بارمصرف و scoped تازه نیاز دارند که پس از تأیید native کاربر صادر شده باشد.
- **Daemon/IPC:** endpoint محلی same-user با metadata محافظت‌شده با HMAC، nonce اختصاصی هر endpoint که روی هر request و event subscription لازم است، messageهای typed/versioned، frame/queueهای محدود، authenticated resubscription خودکار و state resynchronization صریح پس از قطع event stream. در Windows، امنیت endpoint محلی TCP/named pipe بر HMAC-SHA256 bearer-token authentication متکی است که در `%LOCALAPPDATA%` مخصوص کاربر (یا OS Credential Manager) ذخیره می‌شود، نه permissionهای filesystem مربوط به Unix socket.
- **MCP:** ابزارهای صریح، audit recordهای durable از intent/outcome، idempotency key، logهای محدود و recovery برای intentهای در انتظار.
- **External tools/code chunks:** از طریق process broker با executable resolution، environment sanitization، network policy، محدودیت زمان/output، process-tree cancellation و receipt اجرا می‌شوند.
- **Plugins:** runtime فعلی restricted/manifest-first است؛ permission consent، توزیع امضاشده third-party و isolated execution همچنان از الزامات graduation هستند.
- **AI providers:** credentialها داخل native keychain boundary می‌مانند؛ network callها توسط Rust و از endpointهای validateشده صادر می‌شوند و secret خام را در اختیار JavaScript نمی‌گذارند.

## داده و حریم خصوصی

<bdi dir="ltr">Scriptor</bdi> local-first است و telemetry اجباری ندارد. diagnostics به‌صورت opt-in است و فقط باید فیلدهای allowlistشده و redactشده را شامل شود. Remote PlantUML و remote font غیرفعال‌اند. هر integration راه‌دور اختیاری باید endpoint و داده ارسالی را نام ببرد.

## وضعیت رمزگذاری

`crates/vault/src/encryption.rs` primitiveهای رمزنگاری versioned و testها را دارد. **Encrypted vaultها آزمایشی‌اند و capability امنیتی end-to-end پشتیبانی‌شده محسوب نمی‌شوند.** indexها، backupها، تاریخچه Git، فایل‌های موقت، metadata leakage، key recovery و migration صرفاً با یک primitive فایل‌به‌فایل حل نمی‌شوند. [`docs/ENCRYPTION-THREAT-MODEL.fa.md`](docs/ENCRYPTION-THREAT-MODEL.fa.md) را ببینید.

## یکپارچگی انتشار

نصاب‌های رسمی production upstream عمداً unsigned هستند و trust recordهایشان نبود platform signing و notarization را صریح گزارش می‌کنند. انتشار production در عوض به trust-status record صریح برای هر target، checksumهای SHA-256، CycloneDX SBOM، release receipt تغییرناپذیر، exact source identity و GitHub provenance attestation نیاز دارد. دستور راستی‌آزمایی: [`docs/RELEASE-SECURITY.fa.md`](docs/RELEASE-SECURITY.fa.md).
دنباله go/no-go تولید در [`docs/RELEASE-CHECKLIST.fa.md`](docs/RELEASE-CHECKLIST.fa.md) و واژگان evidence و بخش‌های هنوز verifyنشده در [`docs/VERIFICATION.fa.md`](docs/VERIFICATION.fa.md) ثبت شده‌اند.

## سیاست dependency و CI

- <bdi dir="ltr">lockfile</bdi>ها ورودی validation هستند و audit jobها نباید آن‌ها را تغییر دهند؛
- <bdi dir="ltr">GitHub</bdi> Actionهای خارجی از commit SHA کامل، immutable و بازبینی‌شده با comment نسخه دقیق استفاده می‌کنند؛
- <bdi dir="ltr">Node</bdi>، pnpm، Rust، runnerها و ابزارهای release pin شده‌اند؛
- `cargo deny`، `pnpm audit --prod`، action pin، version، boundary، docs و source-contract gateها در CI اجرا می‌شوند؛
- <bdi dir="ltr">dependency</bdi> updateها در تغییرات جداگانه و reviewشده انجام می‌شوند.
