[English](BRAND.md) · [فارسی](BRAND.fa.md) · [简体中文](BRAND.zh-CN.md) · [Русский](BRAND.ru.md) · **Deutsch** · [Español](BRAND.es.md)

# Marke Scriptor

## Name

**Scriptor** — lateinisch für „Schreiber“. Der produktseitige Name des Knowledge Workspace.

**Tagline:** The instrument for serious writing

## Logomarke

Ein detailgetreues, aus Kacheln aufgebautes **S** mit erhaltenen Fasen, Schatten, Code-Glyphen und Partikelstreuung. Die kanonische Datei ist ein echtes SVG aus Vektorpfaden ohne eingebettete Rastergrafik.

| Asset | Pfad | Verwendung |
|---|---|---|
| In-App-Wrapper | `src/brand/BrandMark.tsx` | Topbar, Glass Shell |
| In-App-SVG | `src/brand/BrandMark.tsx` | Inline-SVG mit aktiven Theme-Tokens |
| Kanonische Quelle | `docs/brand/logo-mark.svg` | Statischer Vektor-Master für Doku und Exporte |
| Runtime-Asset | `public/brand-mark.svg` | Statischer Fallback für externe/statische Nutzung |
| Favicon | `public/favicon.svg` | Browser-Tab |
| App-Icon-Master | `docs/brand/app-icon.svg` | Desktop/Mobile-Installer-Icons |
| Transparente Marke | `docs/brand/logo-mark.svg` | Dokumentation, helle Hintergründe |

### Konstruktion

- **Quellformat:** Nur-Pfad-SVG, kein `<image>`-Payload.
- **Komposition:** Türkise Keycap-Kacheln mit erhaltenen Highlights, Schatten, Glyphen-Gravuren und verteilten Partikeln.
- **Skalierung:** Inline-In-App-SVG für Theme-Anpassung; kanonisches SVG für statische Assets.

### Farbe

| Kontext | Behandlung |
|---|---|
| In-App-Shell | Inline-SVG mit `--surface-raised`, `--border`, `--primary` und `--ink-strong` |
| Favicon / Installer | Türkise abgerundete Platte mit Kachel-S |
| Wordmark | `--ink-strong` → `--primary-strong` Gradient-Text |

Installer-PNG/ICO-Assets nach Änderungen der Marke neu erzeugen:

```powershell
pnpm icons:regenerate
```

## Wordmark

- Display: **Sora** (`--font-display`), Gewicht 700, letter-spacing −0.04em
- Gradient: `.brand-wordmark` in `src/App.css`

## Verwendung im Code

```ts
import { BRAND_NAME, BRAND_TAGLINE, BRAND_WORKSPACE_LABEL } from './brand/identity'
import { BrandMark, BrandWordmark } from './brand/BrandMark'
```
