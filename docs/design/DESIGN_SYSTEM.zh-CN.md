# Scriptor 设计系统

[English](DESIGN_SYSTEM.md) · **简体中文** · [Русский](DESIGN_SYSTEM.ru.md) · [Deutsch](DESIGN_SYSTEM.de.md) · [Español](DESIGN_SYSTEM.es.md) · [فارسی](DESIGN_SYSTEM.fa.md)

面向桌面与移动端的精致玻璃质感视觉语言。Token 定义在 `src/index.css` 和 `src/styles/tokens/components.css`，并通过 `src/App.css` 与 `src/styles/motion.css` 中的语义 class 应用。

## 色彩

### Light (`data-theme="light"`)

| Token | Hex 等价值 | 角色 |
|---|---|---|
| `--bg` | `#F6F8FC` | App canvas |
| `--bg-elevated` | `#FFFFFF` | Elevated surface |
| `--ink-strong` | `#0F172A` | 主文本 |
| `--ink` | `#1E293B` | 正文 |
| `--muted` | `#64748B` | 次要文本 |
| `--primary` | `#0D9488` | Accent / links |
| `--primary-strong` | `#0F766E` | Active accent |
| `--glass-bg` | `rgba(255,255,255,0.72)` | Frosted panel |
| `--glass-border` | `rgba(148,163,184,0.35)` | Glass edge |

### Dark (`data-theme="dark"`)

| Token | Hex 等价值 | 角色 |
|---|---|---|
| `--bg` | `#070B14` | App canvas |
| `--bg-elevated` | `#0F172A` | Elevated surface |
| `--ink-strong` | `#F8FAFC` | 主文本 |
| `--ink` | `#E2E8F0` | 正文 |
| `--muted` | `#94A3B8` | 次要文本 |
| `--primary` | `#2DD4BF` | Accent |
| `--primary-strong` | `#14B8A6` | Active accent |
| `--glass-bg` | `rgba(15,23,42,0.65)` | Frosted panel |
| `--glass-border` | `rgba(148,163,184,0.18)` | Glass edge |

## 字体

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

## 间距尺度

`--space-1` (4px) 到 `--space-8` (40px)，按 4px 递增。

## 圆角

| Token | Value |
|---|---|
| `--radius-sm` | `10px` |
| `--radius-md` | `14px` |
| `--radius-lg` | `20px` |
| `--radius-xl` | `28px` |
| `--radius-pill` | `999px` |

## 深度与 Glass

| Token | 用途 |
|---|---|
| `--shadow-sm` | Buttons, chips |
| `--shadow-md` | Panels, cards |
| `--shadow-lg` | Modals, command palette |
| `--glass-blur` | `blur(18px) saturate(1.4)` |
| `--glass-highlight` | Frosted surface 顶缘高光 |

## 动效

| Token | Curve | 用途 |
|---|---|---|
| `--spring-fast` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Press, toggle |
| `--spring-soft` | `cubic-bezier(0.22, 1, 0.36, 1)` | Panel reveal |
| `--spring-gentle` | `cubic-bezier(0.16, 1, 0.3, 1)` | Page transitions |

必须尊重 `prefers-reduced-motion: reduce`：动画退化为即时 state change。

## Component primitives

- `.surface-glass` — 带 backdrop blur 的磨砂 panel
- `.pressable` — active 时带 spring scale 的触觉 button
- `.elevate-hover` — hover 时轻微抬升
- `.fade-rise` — overlay entrance animation
