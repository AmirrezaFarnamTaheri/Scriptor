# Scriptor Brand

## Name

**Scriptor** — Latin for writer. Consumer-facing product name for the knowledge workspace.

**Tagline:** The instrument for serious writing

## Logomark

A high-fidelity tile-built letter **S** with preserved bevels, shadows, coding glyphs, and particle scatter. The canonical file is a real SVG composed of vector paths with no embedded raster image.

| Asset | Path | Use |
|-------|------|-----|
| In-app wrapper | `src/brand/BrandMark.tsx` | Top bar, glass shell |
| In-app SVG | `src/brand/BrandMark.tsx` | Inline SVG driven by the active theme tokens |
| Canonical source | `docs/brand/logo-mark.svg` | Static vector master for documentation and exports |
| Runtime asset | `public/brand-mark.svg` | Static fallback for external/static use |
| Favicon | `public/favicon.svg` | Browser tab |
| App icon master | `docs/brand/app-icon.svg` | Desktop/mobile installer icons |
| Transparent mark | `docs/brand/logo-mark.svg` | Docs, light backgrounds |

### Construction

- **Source format:** Path-only SVG, no `<image>` payload.
- **Composition:** Teal keycap tiles with preserved highlights, shadows, glyph engravings, and dispersed particles.
- **Scaling:** Use the inline in-app SVG where theme adaptation is needed; use the canonical SVG for static assets.

### Color

| Context | Treatment |
|---------|-----------|
| In-app shell | Inline SVG using `--surface-raised`, `--border`, `--primary`, and `--ink-strong` |
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
