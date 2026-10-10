[English](README.md) · [فارسی](README.fa.md) · [简体中文](README.zh-CN.md) · **Русский** · [Deutsch](README.de.md) · [Español](README.es.md)

# Скриншоты Scriptor

Скриншоты для документации и маркетинга, создаваемые Playwright в E2E-режиме.

## Доступные скриншоты

| Скриншот | Описание | Используется в |
|---|---|---|
| workspace-light.png | Проверенный светлый workspace | README / docs |
| workspace-dark.png | Проверенный тёмный workspace | Docs + стабильное visual coverage |
| workspace-tablet.png | Workspace breakpoint 1024 px | VISUAL-REVIEW |
| workspace-mobile.png | Responsive workspace 820 px | VISUAL-REVIEW |
| editor-preview.png | Проверенный split editor/preview | Docs + стабильное visual coverage |
| inspector-preview.png | Inspector preview с editor/preview controls | VISUAL-REVIEW |
| command-palette.png | Проверенная command palette | Docs + стабильное visual coverage |
| graph.png | Проверенный graph | Docs + стабильное visual coverage |
| canvas.png | Пространственный Canvas для визуальной организации заметок | VISUAL-REVIEW, STORE-MIGRATION, CAPABILITIES |
| git-panel.png | Status, commit, pull/push | VISUAL-REVIEW, STORE-MIGRATION |
| mcp-panel.png | Режимы разрешений MCP и рецепты | README / docs |
| mcp-tools.png | Read-only Outline во вкладке Tools | README / docs |
| mcp-audit.png | Audit после read-only Outline | README / docs |
| settings-appearance.png | Appearance: палитра, день/ночь, шрифт, плотность | README / docs |
| plugin-permissions.png | Разрешение чтения Vault Lint до включения | README / docs |
| plugins-installed.png | Vault Lint включён, отзыв для vault | README / docs |
| empty-note.png | Нет активной заметки, действия внутри пустого состояния | README / docs |
| settings.png | Runtime/vault config, appearance, diagnostics | VISUAL-REVIEW, STORE-MIGRATION |
| publish-center.png | Проверенный Publish Center | Docs + стабильное visual coverage |
| vault-health.png | Dashboard здоровья vault с lint/health scores | VISUAL-REVIEW, RELEASE-CHECKLIST |
| knowledge-workbench.png | Knowledge Workbench | VISUAL-REVIEW |
| conflict-resolver.png | 3-way merge с выбором ours/theirs по hunk | VISUAL-REVIEW, STORE-MIGRATION |
| note-history.png | Timeline ревизий с restore | VISUAL-REVIEW |
| keyboard-shortcuts.png | Editor горячих клавиш | VISUAL-REVIEW |
| onboarding-tour.png | Первый product tour | VISUAL-REVIEW |
| plugins.png | Установленные собственные плагины до review разрешений | README / docs |
| editor-recovery.png | Recovery fallback редактора | VISUAL-REVIEW, RELEASE-CHECKLIST |
| mcp-sharing-inventory.png | MCP sharing/resource inventory | VISUAL-REVIEW |
| toolbar-typography.png | Typography popover | VISUAL-REVIEW |
| toolbar-insert.png | Insert popover | VISUAL-REVIEW |
| mobile-inspector.png | Mobile inspector 390 px | VISUAL-REVIEW |
| mobile-vault.png | Mobile vault 390 px | VISUAL-REVIEW |
| workspace-rendered.png | Полный режим рендеринга предпросмотра с заголовками Markdown | VISUAL-REVIEW |
| task-list-preview.png | Отрендеренные элементы списка задач с интерактивными чекбоксами | VISUAL-REVIEW |
| workspace-selector.png | Селектор рабочего пространства и идентификатор активного хранилища в верхней панели | VISUAL-REVIEW |

### Покрытие состояний и границы доказательств

**Workflow state screenshots** независимо выполняет выбранные suites состояний/восстановления и сохраняет отчёты точного commit; полная функциональная suite остаётся обязательной отдельно. `e2e/visual-state-evidence.ts` после проверки содержимого/геометрии снимает viewport и детали. Это свидетельства состояний, отдельно от стабильных baseline и галереи.

| Suite | Состояния |
|---|---|
| `google-ecosystem-workflows.spec.ts` | Drive: выбор, отмена, binding/ошибка сохранения; Docs: preview, конфликт, согласие на потерю, создание; Calendar: выбор/review/import; персидский RTL и zoom |
| `google-gmail-workflows.spec.ts` | Inbox, дедупликация, буквальный текст, import/search/pagination, ошибки, отключение, сохранённые черновики, dark/RTL/zoom |
| `source-files.spec.ts` | Форматы исходников, LaTeX-диагностика, конфликт/отказ, dark |
| `overleaf-workflows.spec.ts` | Вложенные источники и stale-rejection |
| `runtime-kernel.spec.ts` | Сессия, stdout, переменные, декодированный plot, lifecycle-ошибки |
| `asset-media.spec.ts` | Декодированное изображение, audio-controls, отклонение |
| `workspace-shortcuts.spec.ts` | Настройка, overflow, ошибка сохранения, zoom |
| `workspace-leaves.spec.ts` | Группы, перемещение и восстановленные неактивные leaves |
| `semantic-visual-states.spec.ts` | 2D/3D, вращение, сходство, пустой порог, ошибка с сохранением измерений |

Fixtures — детерминированные PNG 320×200 с проверенными декодированными размерами. Они доказывают layout, не камеру или настоящий Python-plot. Google-fixtures не используют live-accounts. Снимки становятся свидетельством выполнения только после успешной hosted-suite точного commit и просмотра изображений. Docs-only состояния охватывают согласие/enable/revoke плагинов, MCP Outline/Audit, Appearance, Canvas, плотный граф, triage, Help, native selector, RTL, компактный немецкий, zoom/scale, loading, большой vault и dark-диалоги. Они не доказывают внешний MCP, нативное разрешение или стороннюю установку. Native `<select>` проверяется семантически; OS-popup не заявлен надёжной целью скриншота.

### Актуальность и принятие

PNG документации — **свежие снимки текущего исходного кода**, а не копии сохранённых Playwright comparison baselines. Тесты сначала записывают стабилизированную страницу прямо в `docs/assets/screenshots/`, затем независимо выполняют `toHaveScreenshot` против стабильных Windows baselines из `e2e/screenshots.spec.ts-snapshots/`.

Разделение намеренное. Сохранённая baseline может оставаться допустимой, если текущий render отличается в пределах visual tolerance; копирование старой baseline поверх свежей docs-картинки сделало бы документацию устаревшей при зелёной visual suite.

Стабильные Windows baselines остаются acceptance surface visual regression. Намеренные pixel changes проверяются и явно обновляются через `--update-snapshots=all`; failures никогда не скрываются повышением глобальной tolerance.

**Visual review** выполняет один compare-only проход на закреплённом Windows с `--update-snapshots=none`; PR не переписывает baseline. Ошибки уже сохраняют actual/diff, traces, videos и свежие docs-снимки. Изменять baseline можно только явным refresh. `visual-review.zip` хранит уникальные текущие изображения в `images/`; `image-manifest.json` указывает SHA-256, размер и все пути происхождения. Точные дубликаты сохраняются однажды; параллельные сырые result/baseline деревья не загружаются.

Responsive/state-review captures (`workspace-mobile`, `workspace-tablet`, mobile vault/inspector, editor recovery, MCP inventory, toolbar popovers) создаются из живого test output и не становятся стабильными pixel baselines, если тест явно не использует `toHaveScreenshot`.

## Перегенерация

Снимки создаются Playwright в E2E. Mock IPC bridge предоставляет fixture data, поэтому настоящий vault или Tauri binary не нужны. Capture ждёт fonts, видимые images, lazy panels, завершение переходов и не-degraded preview state.

Обычный локальный capture:

```powershell
pnpm screenshots:capture:web
```

Намеренный refresh на закреплённой Windows-среде:

```powershell
./scripts/screenshots/capture.ps1 -SkipDesktopBuild -UpdateBaselines
```

`-UpdateBaselines` пересоздаёт все стабильные Windows snapshots с `--update-snapshots=all`, обновляет docs-only state-review screenshots из свежего Playwright output и сохраняет docs captures, записанные `screenshots.spec.ts`. Он **не** копирует baseline PNG поверх docs.

После публикации `release.yml` вызывает **Refresh documentation screenshots** на `main`. Снимается текущий main, не release-tag; отдельный workflow должен сам завершиться успешно. Можно вручную выбрать review-branch. Закреплённые Windows/Edge проверяют контракты, обновляют docs/baseline, проверяют без updates и коммитят только PNG. Manifest-package дедуплицирует SHA-256. Push не принудительный: продвижение ветки безопасно вызывает отказ и требует повторения.

### Build в E2E

```powershell
pnpm exec vite build --mode e2e
```

Vite загружает `.env.e2e`; не экспортируйте `VITE_E2E_MODE` в parent shell. E2E builds используют отдельные output dirs. Production bundle validation отвергает test-only fault-injection markers при утечке E2E env в release assets.

### Playwright screenshot tests

```powershell
$env:VITE_SCREENSHOT_MODE = 'true'
$env:SCRIPTOR_CAPTURE_SCREENSHOTS = 'true'
pnpm exec playwright test --config playwright.e2e.config.ts e2e/screenshots.spec.ts --workers=1
```

### Переопределение browser channel

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chrome'
```

## Архитектура

Pipeline использует тот же E2E mock IPC bridge, что и функциональные тесты:

- **`playwright.e2e.config.ts`** — E2E и docs capture
- **`playwright.visual.config.ts`** — stable visual regression/state-review
- **`e2e/screenshots.spec.ts`** — стабильные сценарии; свежие docs captures + baseline validation
- **`e2e/visual-review.spec.ts`** — responsive/state-review evidence
- **`scripts/screenshots/capture.ps1`** — deterministic capture/orchestration contract
- **`scripts/validation/screenshot-capture-contracts.test.mjs`** — guard от stale baseline overwrite
- **`src/e2e/bootstrap.ts`** — mock IPC bridge с vault/Git/indexer/export data
- **`src/e2e/state.ts`** — in-memory state mock vault
- **`src/screenshot/fixture.ts`** — fixtures vault/scan/graph/health

После UI-изменений, влияющих на layout или copy, регенерируйте и проверяйте PNG. Запишите browser/channel, OS, source commit, viewport и результат в release PR. См. [`../../validation/FRONTEND_QUALITY.ru.md`](../../validation/FRONTEND_QUALITY.ru.md).
