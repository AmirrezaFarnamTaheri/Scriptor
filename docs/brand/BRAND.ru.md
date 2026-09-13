[English](BRAND.md) · [فارسی](BRAND.fa.md) · [简体中文](BRAND.zh-CN.md) · **Русский** · [Deutsch](BRAND.de.md) · [Español](BRAND.es.md)

# Бренд Scriptor

## Название

**Scriptor** — латинское «писатель». Пользовательское название продукта для knowledge workspace.

**Слоган:** The instrument for serious writing

## Логомарк

Высокодетализированная буква **S**, собранная из плиток-клавиш с сохранёнными фасками, тенями, кодовыми глифами и рассеянными частицами. Канонический файл — настоящий SVG из векторных путей без встроенного растра.

| Ресурс | Путь | Использование |
|---|---|---|
| In-app wrapper | `src/brand/BrandMark.tsx` | Top bar, glass shell |
| In-app SVG | `src/brand/BrandMark.tsx` | Inline SVG на активных theme tokens |
| Канонический источник | `docs/brand/logo-mark.svg` | Статический векторный мастер для docs/экспорта |
| Runtime asset | `public/brand-mark.svg` | Статический fallback для внешнего использования |
| Favicon | `public/favicon.svg` | Вкладка браузера |
| Master app icon | `docs/brand/app-icon.svg` | Иконки desktop/mobile installer |
| Прозрачная марка | `docs/brand/logo-mark.svg` | Docs, светлые фоны |

### Построение

- **Исходный формат:** SVG только из path, без `<image>` payload.
- **Композиция:** бирюзовые keycap-плитки с highlights, тенями, выгравированными glyphs и рассеянными частицами.
- **Масштабирование:** inline SVG в приложении для адаптации темы; канонический SVG для статических assets.

### Цвет

| Контекст | Обработка |
|---|---|
| In-app shell | Inline SVG с `--surface-raised`, `--border`, `--primary`, `--ink-strong` |
| Favicon / installers | Бирюзовая скруглённая пластина с плиточной S |
| Wordmark | Gradient text `--ink-strong` → `--primary-strong` |

После изменения марки пересоздайте PNG/ICO для installer:

```powershell
pnpm icons:regenerate
```

## Wordmark

- Display: **Sora** (`--font-display`), weight 700, letter-spacing −0.04em
- Gradient: `.brand-wordmark` в `src/App.css`

## Использование в коде

```ts
import { BRAND_NAME, BRAND_TAGLINE, BRAND_WORKSPACE_LABEL } from './brand/identity'
import { BrandMark, BrandWordmark } from './brand/BrandMark'
```
