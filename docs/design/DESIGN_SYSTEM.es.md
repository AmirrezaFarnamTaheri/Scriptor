# Sistema de diseño de Scriptor

[English](DESIGN_SYSTEM.md) · [简体中文](DESIGN_SYSTEM.zh-CN.md) · [Русский](DESIGN_SYSTEM.ru.md) · [Deutsch](DESIGN_SYSTEM.de.md) · **Español** · [فارسی](DESIGN_SYSTEM.fa.md)

Lenguaje visual premium centrado en superficies de vidrio para desktop y mobile. Los tokens se definen en `src/index.css` y `src/styles/tokens/components.css`, y se aplican mediante clases semánticas en `src/App.css` y `src/styles/motion.css`.

## Paleta de color

### Light (`data-theme="light"`)

| Token | Hex equivalente | Rol |
|---|---|---|
| `--bg` | `#F6F8FC` | Canvas de la app |
| `--bg-elevated` | `#FFFFFF` | Superficies elevadas |
| `--ink-strong` | `#0F172A` | Texto principal |
| `--ink` | `#1E293B` | Texto de cuerpo |
| `--muted` | `#64748B` | Texto secundario |
| `--primary` | `#0D9488` | Acento / enlaces |
| `--primary-strong` | `#0F766E` | Acento activo |
| `--glass-bg` | `rgba(255,255,255,0.72)` | Paneles frosted |
| `--glass-border` | `rgba(148,163,184,0.35)` | Borde glass |

### Dark (`data-theme="dark"`)

| Token | Hex equivalente | Rol |
|---|---|---|
| `--bg` | `#070B14` | Canvas de la app |
| `--bg-elevated` | `#0F172A` | Superficies elevadas |
| `--ink-strong` | `#F8FAFC` | Texto principal |
| `--ink` | `#E2E8F0` | Texto de cuerpo |
| `--muted` | `#94A3B8` | Texto secundario |
| `--primary` | `#2DD4BF` | Acento |
| `--primary-strong` | `#14B8A6` | Acento activo |
| `--glass-bg` | `rgba(15,23,42,0.65)` | Paneles frosted |
| `--glass-border` | `rgba(148,163,184,0.18)` | Borde glass |

## Tipografía

| Token | Valor |
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

## Escala de espaciado

`--space-1` (4px) a `--space-8` (40px), en incrementos de 4px.

## Radio

| Token | Valor |
|---|---|
| `--radius-sm` | `10px` |
| `--radius-md` | `14px` |
| `--radius-lg` | `20px` |
| `--radius-xl` | `28px` |
| `--radius-pill` | `999px` |

## Profundidad y glass

| Token | Uso |
|---|---|
| `--shadow-sm` | Buttons, chips |
| `--shadow-md` | Panels, cards |
| `--shadow-lg` | Modals, command palette |
| `--glass-blur` | `blur(18px) saturate(1.4)` |
| `--glass-highlight` | Reflejo del borde superior en superficies frosted |

## Movimiento

| Token | Curva | Uso |
|---|---|---|
| `--spring-fast` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Press, toggle |
| `--spring-soft` | `cubic-bezier(0.22, 1, 0.36, 1)` | Panel reveal |
| `--spring-gentle` | `cubic-bezier(0.16, 1, 0.3, 1)` | Page transitions |

Respete `prefers-reduced-motion: reduce`: las animaciones se convierten en cambios de estado instantáneos.

## Primitivas de componentes

- `.surface-glass` — panel frosted con backdrop blur
- `.pressable` — botón táctil con spring scale al estar active
- `.elevate-hover` — elevación suave en hover
- `.fade-rise` — animation de entrada para overlays
