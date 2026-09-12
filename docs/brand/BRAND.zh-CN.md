[English](BRAND.md) · [فارسی](BRAND.fa.md) · **简体中文** · [Русский](BRAND.ru.md) · [Deutsch](BRAND.de.md) · [Español](BRAND.es.md)

# Scriptor 品牌

## 名称

**Scriptor** — 拉丁语“书写者”。面向用户的知识工作区产品名称。

**标语：**The instrument for serious writing

## 标志图形

高保真、由方块/键帽构成的字母 **S**，保留倒角、阴影、代码字形和粒子散射。权威文件是真正由矢量路径组成的 SVG，不嵌入栅格图像。

| 资源 | 路径 | 用途 |
|---|---|---|
| App 内 wrapper | `src/brand/BrandMark.tsx` | 顶栏、glass shell |
| App 内 SVG | `src/brand/BrandMark.tsx` | 由活动 theme token 驱动的 inline SVG |
| 权威源 | `docs/brand/logo-mark.svg` | 文档和导出的静态矢量母版 |
| Runtime 资源 | `public/brand-mark.svg` | 外部/静态用途的 fallback |
| Favicon | `public/favicon.svg` | 浏览器标签页 |
| App icon 母版 | `docs/brand/app-icon.svg` | Desktop/mobile installer 图标 |
| 透明标记 | `docs/brand/logo-mark.svg` | 文档、浅色背景 |

### 构造

- **源格式：**仅 path 的 SVG，不含 `<image>` payload。
- **构图：**青绿色 keycap 方块，保留高光、阴影、字形雕刻与分散粒子。
- **缩放：**需要适配主题时使用 app 内 inline SVG；静态资源使用权威 SVG。

### 颜色

| 上下文 | 处理方式 |
|---|---|
| App shell | 使用 `--surface-raised`、`--border`、`--primary`、`--ink-strong` 的 inline SVG |
| Favicon / installer | 带圆角的青绿色底板 + 方块 S |
| Wordmark | `--ink-strong` → `--primary-strong` 渐变文字 |

标记改变后重新生成 installer PNG/ICO：

```powershell
pnpm icons:regenerate
```

## Wordmark

- Display：**Sora** (`--font-display`)，weight 700，letter-spacing −0.04em
- Gradient：`src/App.css` 中的 `.brand-wordmark`

## 代码用法

```ts
import { BRAND_NAME, BRAND_TAGLINE, BRAND_WORKSPACE_LABEL } from './brand/identity'
import { BrandMark, BrandWordmark } from './brand/BrandMark'
```
