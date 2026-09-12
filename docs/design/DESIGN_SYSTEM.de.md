# Scriptor Design System

[English](DESIGN_SYSTEM.md) · [简体中文](DESIGN_SYSTEM.zh-CN.md) · [Русский](DESIGN_SYSTEM.ru.md) · **Deutsch** · [Español](DESIGN_SYSTEM.es.md) · [فارسی](DESIGN_SYSTEM.fa.md)

Hochwertige, glasorientierte visuelle Sprache für Desktop und Mobile. Tokens sind in `src/index.css` und `src/styles/tokens/components.css` definiert und werden über semantische Klassen in `src/App.css` und `src/styles/motion.css` angewendet.

## Farbpalette

### Light (`data-theme="light"`)

| Token | Hex-Äquivalent | Rolle |
|---|---|---|
| `--bg` | `#F6F8FC` | App Canvas |
| `--bg-elevated` | `#FFFFFF` | Erhöhte Oberflächen |
| `--ink-strong` | `#0F172A` | Primärtext |
| `--ink` | `#1E293B` | Fließtext |
| `--muted` | `#64748B` | Sekundärtext |
| `--primary` | `#0D9488` | Akzent / Links |
| `--primary-strong` | `#0F766E` | Aktiver Akzent |
| `--glass-bg` | `rgba(255,255,255,0.72)` | Frosted Panels |
| `--glass-border` | `rgba(148,163,184,0.35)` | Glass Edge |

### Dark (`data-theme="dark"`)

| Token | Hex-Äquivalent | Rolle |
|---|---|---|
| `--bg` | `#070B14` | App Canvas |
| `--bg-elevated` | `#0F172A` | Erhöhte Oberflächen |
| `--ink-strong` | `#F8FAFC` | Primärtext |
| `--ink` | `#E2E8F0` | Fließtext |
| `--muted` | `#94A3B8` | Sekundärtext |
| `--primary` | `#2DD4BF` | Akzent |
| `--primary-strong` | `#14B8A6` | Aktiver Akzent |
| `--glass-bg` | `rgba(15,23,42,0.65)` | Frosted Panels |
| `--glass-border` | `rgba(148,163,184,0.18)` | Glass Edge |

## Typografie

| Token | Wert |
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

## Abstandsskala

`--space-1` (4px) bis `--space-8` (40px) in 4px-Schritten.

## Radien

| Token | Wert |
|---|---|
| `--radius-sm` | `10px` |
| `--radius-md` | `14px` |
| `--radius-lg` | `20px` |
| `--radius-xl` | `28px` |
| `--radius-pill` | `999px` |

## Tiefe & Glass

| Token | Verwendung |
|---|---|
| `--shadow-sm` | Buttons, Chips |
| `--shadow-md` | Panels, Cards |
| `--shadow-lg` | Modals, Command Palette |
| `--glass-blur` | `blur(18px) saturate(1.4)` |
| `--glass-highlight` | Oberer Glanzrand auf Frosted Surfaces |

## Motion

| Token | Kurve | Verwendung |
|---|---|---|
| `--spring-fast` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Press, Toggle |
| `--spring-soft` | `cubic-bezier(0.22, 1, 0.36, 1)` | Panel Reveal |
| `--spring-gentle` | `cubic-bezier(0.16, 1, 0.3, 1)` | Page Transitions |

`prefers-reduced-motion: reduce` respektieren — Animationen werden zu sofortigen Zustandswechseln.

## Component Primitives

- `.surface-glass` — Frosted Panel mit Backdrop Blur
- `.pressable` — taktiler Button mit Spring Scale bei Active
- `.elevate-hover` — sanfter Lift bei Hover
- `.fade-rise` — Entrance Animation für Overlays
