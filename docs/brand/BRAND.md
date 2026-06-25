# Scriptor Brand

## Name

**Scriptor** — Latin for writer. Consumer-facing product name for the knowledge workspace.

**Tagline:** The instrument for serious writing

## Logomark

A high-fidelity tile-built letter **S** with preserved bevels, shadows, coding glyphs, and particle scatter. The canonical file is a real SVG composed of vector paths with no embedded raster image.

| Asset | Path | Use |
|-------|------|-----|
| In-app wrapper | `src/brand/BrandMark.tsx` | Top bar, glass shell |
| Canonical source | `docs/brand/logo-mark.svg` | Single source-of-truth vector asset |
| Runtime asset | `public/brand-mark.svg` | Served in-app without bundling the full SVG |
| Favicon | `public/favicon.svg` | Browser tab |
| App icon master | `docs/brand/app-icon.svg` | Desktop/mobile installer icons |
| Transparent mark | `docs/brand/logo-mark.svg` | Docs, light backgrounds |

### Construction

- **Source format:** Path-only SVG, no `<image>` payload.
- **Composition:** Teal keycap tiles with preserved highlights, shadows, glyph engravings, and dispersed particles.
- **Scaling:** Use the canonical SVG for parity; derive smaller assets from it.

### Color

| Context | Treatment |
|---------|-----------|
| In-app shell | Theme-aware teal tiles on subtle dot grid |
| Favicon / installers | Teal rounded plate with tile S |
| Wordmark | `--ink-strong` → `--primary-strong` gradient text |

Regenerate installer PNG/ICO assets after mark changes:

```powershell
pnpm icons:regenerate
```

## Wordmark

- Display: **Sora** (`--font-display`), weight 700, letter-spacing −0.04em
- Gradient: `.brand-wordmark` in `src/App.css`

## Code usage

```ts
import { BRAND_NAME, BRAND_TAGLINE, BRAND_WORKSPACE_LABEL } from './brand/identity'
import { BrandMark, BrandWordmark } from './brand/BrandMark'
```
