# Scriptor Design System

Premium glass-forward visual language for desktop and mobile. Tokens are defined in `src/index.css` and applied through semantic classes in `src/App.css` and `src/styles/motion.css`.

## Color palette

### Light (`data-theme="light"`)

| Token | Hex equivalent | Role |
|-------|----------------|------|
| `--bg` | `#F6F8FC` | App canvas |
| `--bg-elevated` | `#FFFFFF` | Raised surfaces |
| `--ink-strong` | `#0F172A` | Primary text |
| `--ink` | `#1E293B` | Body text |
| `--muted` | `#64748B` | Secondary text |
| `--primary` | `#0D9488` | Accent / links |
| `--primary-strong` | `#0F766E` | Active accent |
| `--glass-bg` | `rgba(255,255,255,0.72)` | Frosted panels |
| `--glass-border` | `rgba(148,163,184,0.35)` | Glass edge |

### Dark (`data-theme="dark"`)

| Token | Hex equivalent | Role |
|-------|----------------|------|
| `--bg` | `#070B14` | App canvas |
| `--bg-elevated` | `#0F172A` | Raised surfaces |
| `--ink-strong` | `#F8FAFC` | Primary text |
| `--ink` | `#E2E8F0` | Body text |
| `--muted` | `#94A3B8` | Secondary text |
| `--primary` | `#2DD4BF` | Accent |
| `--primary-strong` | `#14B8A6` | Active accent |
| `--glass-bg` | `rgba(15,23,42,0.65)` | Frosted panels |
| `--glass-border` | `rgba(148,163,184,0.18)` | Glass edge |

## Typography

| Token | Value |
|-------|-------|
| `--font-display` | `Sora, Inter, system-ui` |
| `--font-body` | `Inter, system-ui` |
| `--font-mono` | `JetBrains Mono, Cascadia Code, monospace` |
| `--text-xs` | `11px / 1.35` |
| `--text-sm` | `13px / 1.45` |
| `--text-base` | `14px / 1.5` |
| `--text-lg` | `16px / 1.45` |
| `--text-xl` | `20px / 1.3` |
| `--text-2xl` | `26px / 1.2` |

## Spacing scale

`--space-1` (4px) through `--space-8` (40px) in 4px increments.

## Radius

| Token | Value |
|-------|-------|
| `--radius-sm` | `10px` |
| `--radius-md` | `14px` |
| `--radius-lg` | `20px` |
| `--radius-xl` | `28px` |
| `--radius-pill` | `999px` |

## Depth & glass

| Token | Usage |
|-------|-------|
| `--shadow-sm` | Buttons, chips |
| `--shadow-md` | Panels, cards |
| `--shadow-lg` | Modals, command palette |
| `--glass-blur` | `blur(18px) saturate(1.4)` |
| `--glass-highlight` | Top edge specular on frosted surfaces |

## Motion

| Token | Curve | Use |
|-------|-------|-----|
| `--spring-fast` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Press, toggle |
| `--spring-soft` | `cubic-bezier(0.22, 1, 0.36, 1)` | Panel reveal |
| `--spring-gentle` | `cubic-bezier(0.16, 1, 0.3, 1)` | Page transitions |

Respect `prefers-reduced-motion: reduce` — animations collapse to instant state changes.

## Component primitives

- `.surface-glass` — frosted panel with backdrop blur
- `.pressable` — tactile button with spring scale on active
- `.elevate-hover` — soft lift on hover
- `.fade-rise` — entrance animation for overlays
