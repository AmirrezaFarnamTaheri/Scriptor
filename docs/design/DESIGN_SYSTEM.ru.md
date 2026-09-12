# Дизайн-система Scriptor

[English](DESIGN_SYSTEM.md) · [简体中文](DESIGN_SYSTEM.zh-CN.md) · **Русский** · [Deutsch](DESIGN_SYSTEM.de.md) · [Español](DESIGN_SYSTEM.es.md) · [فارسی](DESIGN_SYSTEM.fa.md)

Премиальный визуальный язык с акцентом на glass-поверхности для desktop и mobile. Токены определены в `src/index.css` и `src/styles/tokens/components.css`, применяются через семантические классы `src/App.css` и `src/styles/motion.css`.

## Палитра

### Light (`data-theme="light"`)

| Token | Hex | Роль |
|---|---|---|
| `--bg` | `#F6F8FC` | Холст приложения |
| `--bg-elevated` | `#FFFFFF` | Приподнятые поверхности |
| `--ink-strong` | `#0F172A` | Основной текст |
| `--ink` | `#1E293B` | Текст тела |
| `--muted` | `#64748B` | Вторичный текст |
| `--primary` | `#0D9488` | Акцент / ссылки |
| `--primary-strong` | `#0F766E` | Активный акцент |
| `--glass-bg` | `rgba(255,255,255,0.72)` | Frosted panels |
| `--glass-border` | `rgba(148,163,184,0.35)` | Glass edge |

### Dark (`data-theme="dark"`)

| Token | Hex | Роль |
|---|---|---|
| `--bg` | `#070B14` | Холст приложения |
| `--bg-elevated` | `#0F172A` | Приподнятые поверхности |
| `--ink-strong` | `#F8FAFC` | Основной текст |
| `--ink` | `#E2E8F0` | Текст тела |
| `--muted` | `#94A3B8` | Вторичный текст |
| `--primary` | `#2DD4BF` | Акцент |
| `--primary-strong` | `#14B8A6` | Активный акцент |
| `--glass-bg` | `rgba(15,23,42,0.65)` | Frosted panels |
| `--glass-border` | `rgba(148,163,184,0.18)` | Glass edge |

## Типографика

| Token | Value |
|---|---|
| `--font-display` | `Sora, Inter, system-ui` |
| `--font-body` | `Inter, system-ui` |
| `--font-mono` | `JetBrains Mono, Cascadia Code, monospace` |
| `--text-xs` | `11px / 1.35` |
| `--text-sm` | `13px / 1.45` |
| `--text-base` | `14px / 1.5` |
| `--text-lg` | `16px / 1.45` |
| `--text-xl` | `20px / 1.3` |
| `--text-2xl` | `26px / 1.2` |

## Шкала отступов

От `--space-1` (4px) до `--space-8` (40px) с шагом 4px.

## Радиусы

| Token | Value |
|---|---|
| `--radius-sm` | `10px` |
| `--radius-md` | `14px` |
| `--radius-lg` | `20px` |
| `--radius-xl` | `28px` |
| `--radius-pill` | `999px` |

## Глубина и glass

| Token | Использование |
|---|---|
| `--shadow-sm` | Buttons, chips |
| `--shadow-md` | Panels, cards |
| `--shadow-lg` | Modals, command palette |
| `--glass-blur` | `blur(18px) saturate(1.4)` |
| `--glass-highlight` | Верхний блик на frosted surfaces |

## Движение

| Token | Curve | Использование |
|---|---|---|
| `--spring-fast` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Press, toggle |
| `--spring-soft` | `cubic-bezier(0.22, 1, 0.36, 1)` | Panel reveal |
| `--spring-gentle` | `cubic-bezier(0.16, 1, 0.3, 1)` | Page transitions |

Уважайте `prefers-reduced-motion: reduce`: анимации превращаются в мгновенные смены состояния.

## Примитивы компонентов

- `.surface-glass` — frosted panel с backdrop blur
- `.pressable` — tactile button со spring scale при active
- `.elevate-hover` — мягкий подъём при hover
- `.fade-rise` — entrance animation для overlays
