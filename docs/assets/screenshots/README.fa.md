<div dir="ltr" align="center">

[English](README.md) · **فارسی** · [简体中文](README.zh-CN.md) · [Русский](README.ru.md) · [Deutsch](README.de.md) · [Español](README.es.md)

</div>

<div dir="rtl" lang="fa" align="right">

# screenshotهای Scriptor

screenshotهای مربوط به مستندات و marketing با Playwright در حالت E2E تولید می‌شوند.

## screenshotهای موجود

| screenshot | توضیح | استفاده در |
|---|---|---|
| workspace-light.png | capture بازبینی‌شده workspace روشن | README / docs |
| workspace-dark.png | capture بازبینی‌شده workspace تاریک | Docs + پوشش بصری stable |
| workspace-tablet.png | breakpoint برابر 1024 px | VISUAL-REVIEW |
| workspace-mobile.png | workspace responsive در 820 px | VISUAL-REVIEW |
| editor-preview.png | split editor/preview بازبینی‌شده | Docs + پوشش بصری stable |
| inspector-preview.png | Inspector preview با کنترل editor/preview | VISUAL-REVIEW |
| command-palette.png | command palette بازبینی‌شده | Docs + پوشش بصری stable |
| graph.png | graph بازبینی‌شده | Docs + پوشش بصری stable |
| canvas.png | Canvas فضایی برای چیدمان بصری noteها | VISUAL-REVIEW, STORE-MIGRATION, CAPABILITIES |
| git-panel.png | status، commit، pull/push در version control | VISUAL-REVIEW, STORE-MIGRATION |
| mcp-panel.png | panel بازبینی‌شده MCP | Docs + پوشش بصری stable |
| settings.png | config runtime/vault، appearance، diagnostics | VISUAL-REVIEW, STORE-MIGRATION |
| publish-center.png | Publish Center بازبینی‌شده | Docs + پوشش بصری stable |
| vault-health.png | dashboard سلامت vault با lint و health score | VISUAL-REVIEW, RELEASE-CHECKLIST |
| knowledge-workbench.png | Knowledge Workbench | VISUAL-REVIEW |
| conflict-resolver.png | merge سه‌طرفه با انتخاب ours/theirs در سطح hunk | VISUAL-REVIEW, STORE-MIGRATION |
| note-history.png | timeline revision با قابلیت restore | VISUAL-REVIEW |
| keyboard-shortcuts.png | editor میانبرهای صفحه‌کلید | VISUAL-REVIEW |
| onboarding-tour.png | tour اولین اجرای محصول | VISUAL-REVIEW |
| plugins.png | discovery و مدیریت plugin | VISUAL-REVIEW, STORE-MIGRATION, CAPABILITIES |
| editor-recovery.png | state fallback بازیابی editor | VISUAL-REVIEW, RELEASE-CHECKLIST |
| mcp-sharing-inventory.png | نمای sharing و inventory resource در MCP | VISUAL-REVIEW |
| toolbar-typography.png | popover مربوط به typography | VISUAL-REVIEW |
| toolbar-insert.png | popover مربوط به insert | VISUAL-REVIEW |
| mobile-inspector.png | pane موبایل Inspector در 390 px | VISUAL-REVIEW |
| mobile-vault.png | pane موبایل vault در 390 px | VISUAL-REVIEW |

### تازگی و پذیرش

PNGهای مستندات **capture تازه از source فعلی** هستند، نه copy از comparison baseline ذخیره‌شده Playwright. آزمون screenshot ابتدا صفحه settleشده را مستقیم در `docs/assets/screenshots/` capture می‌کند و سپس مستقل از آن `toHaveScreenshot` را در برابر Windows baselineهای stable در `e2e/screenshots.spec.ts-snapshots/` اجرا می‌کند.

این تفکیک عمدی است. baseline ذخیره‌شده می‌تواند وقتی render فعلی در محدوده visual tolerance پیکربندی‌شده تفاوت دارد همچنان پذیرفته شود؛ copy کردن baseline روی تصویر تازه مستندات باعث می‌شود docs با وجود pass بودن regression suite قدیمی بمانند.

Windows baselineهای stable سطح پذیرش visual regression هستند. تغییر عمدی pixel باید بازبینی و صریحاً با `--update-snapshots=all` refresh شود؛ failure بصری هرگز با افزایش tolerance سراسری پنهان نمی‌شود.

captureهای responsive و state-review (`workspace-mobile`، `workspace-tablet`، vault/inspector موبایل، editor recovery، MCP sharing inventory و toolbar popoverها) از خروجی live آزمون ساخته می‌شوند و مگر آن‌که test صریحاً `toHaveScreenshot` داشته باشد، به pixel baseline stable تبدیل نمی‌شوند.

## تولید دوباره

screenshotها با Playwright در E2E گرفته می‌شوند. mock IPC bridge داده fixture فراهم می‌کند، بنابراین vault واقعی یا binary مربوط به Tauri لازم نیست. capture پیش از نوشتن pixel مستندات منتظر fontها، imageهای visible، lazy panelها، transitionهای محدود و state غیر-degraded preview می‌ماند.

برای capture عادی محلی:

</div>

<div dir="ltr" align="left">

```powershell
pnpm screenshots:capture:web
```

</div>

<div dir="rtl" lang="fa" align="right">

برای refresh عمدی بصری در محیط pinned Windows:

</div>

<div dir="ltr" align="left">

```powershell
./scripts/screenshots/capture.ps1 -SkipDesktopBuild -UpdateBaselines
```

</div>

<div dir="rtl" lang="fa" align="right">

`-UpdateBaselines` همه snapshotهای stable ویندوز را با `--update-snapshots=all` دوباره تولید می‌کند، screenshotهای docs-only مربوط به state review را از خروجی تازه Playwright refresh می‌کند و captureهای مستنداتی نوشته‌شده توسط `screenshots.spec.ts` را نگه می‌دارد. این فرمان PNG baseline ذخیره‌شده را روی دایرکتوری docs **copy نمی‌کند**.

workflow دستی **Refresh documentation screenshots** نیز وجود دارد. آن را روی review branch اجرا کنید، نه `main`. این workflow از runner pinned با نام `windows-2025` و Edge استفاده می‌کند، contract testهای capture را اجرا می‌کند، docs و Windows baselineهای stable را دوباره می‌سازد، visual suite کامل را بدون snapshot update verify می‌کند و فقط تغییرهای PNG تولیدشده را به branch انتخاب‌شده commit می‌کند.

### Build در حالت E2E

</div>

<div dir="ltr" align="left">

```powershell
pnpm exec vite build --mode e2e
```

</div>

<div dir="rtl" lang="fa" align="right">

Vite در این mode فایل `.env.e2e` را load می‌کند؛ `VITE_E2E_MODE` را در parent shell export نکنید. buildهای E2E از output directory جداگانه در configهای Playwright استفاده می‌کنند. production bundle validation اگر environment مربوط به E2E وارد release assetها شود، markerهای fault-injection ویژه test را رد می‌کند.

### اجرای آزمون screenshot در Playwright

</div>

<div dir="ltr" align="left">

```powershell
$env:VITE_SCREENSHOT_MODE = 'true'
$env:SCRIPTOR_CAPTURE_SCREENSHOTS = 'true'
pnpm exec playwright test --config playwright.e2e.config.ts e2e/screenshots.spec.ts --workers=1
```

</div>

<div dir="rtl" lang="fa" align="right">

### override کردن browser channel

</div>

<div dir="ltr" align="left">

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chrome'
```

</div>

<div dir="rtl" lang="fa" align="right">

## معماری

pipeline screenshot از همان E2E mock IPC bridge آزمون‌های functional استفاده می‌کند:

- **`playwright.e2e.config.ts`** — config Playwright برای E2E و capture مستندات
- **`playwright.visual.config.ts`** — visual regression stable و state-review verification
- **`e2e/screenshots.spec.ts`** — سناریوهای stable؛ capture تازه docs را می‌نویسد و baseline را validate می‌کند
- **`e2e/visual-review.spec.ts`** — evidence مربوط به responsive و state-review
- **`scripts/screenshots/capture.ps1`** — قرارداد deterministic برای capture/orchestration
- **`scripts/validation/screenshot-capture-contracts.test.mjs`** — regression guard در برابر overwrite شدن capture تازه با baseline قدیمی
- **`src/e2e/bootstrap.ts`** — mock IPC bridge برای داده vault، Git، indexer و export
- **`src/e2e/state.ts`** — state درون‌حافظه‌ای note در mock vault
- **`src/screenshot/fixture.ts`** — fixture مربوط به vault، scan، graph و health diagnostics

پس از تغییر UI که layout یا copy را تغییر می‌دهد، PNGها را regenerate و review کنید. browser/channel، OS، source commit، viewport و نتیجه را در release PR ثبت کنید. [`../../validation/FRONTEND_QUALITY.fa.md`](../../validation/FRONTEND_QUALITY.fa.md) را ببینید.

</div>
