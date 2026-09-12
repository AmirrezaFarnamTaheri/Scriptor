[English](BRAND.md) · [فارسی](BRAND.fa.md) · [简体中文](BRAND.zh-CN.md) · [Русский](BRAND.ru.md) · [Deutsch](BRAND.de.md) · **Español**

# Marca Scriptor

## Nombre

**Scriptor** — «escritor» en latín. Nombre del producto de cara al usuario para el espacio de trabajo de conocimiento.

**Tagline:** The instrument for serious writing

## Isotipo

Una letra **S** de alta fidelidad construida con teclas/baldosas, conservando biseles, sombras, glifos de código y dispersión de partículas. El archivo canónico es un SVG real compuesto por rutas vectoriales, sin imagen raster incrustada.

| Recurso | Ruta | Uso |
|---|---|---|
| Wrapper in-app | `src/brand/BrandMark.tsx` | Barra superior, shell de vidrio |
| SVG in-app | `src/brand/BrandMark.tsx` | SVG inline controlado por los tokens activos |
| Fuente canónica | `docs/brand/logo-mark.svg` | Maestro vectorial estático para docs y exportación |
| Recurso runtime | `public/brand-mark.svg` | Fallback estático para uso externo/estático |
| Favicon | `public/favicon.svg` | Pestaña del navegador |
| Maestro del icono | `docs/brand/app-icon.svg` | Iconos de instaladores desktop/móvil |
| Marca transparente | `docs/brand/logo-mark.svg` | Docs y fondos claros |

### Construcción

- **Formato fuente:** SVG solo con rutas, sin payload `<image>`.
- **Composición:** teclas verde azulado con luces, sombras, glifos grabados y partículas dispersas.
- **Escalado:** use el SVG inline dentro de la app cuando necesite adaptación al tema; el SVG canónico para recursos estáticos.

### Color

| Contexto | Tratamiento |
|---|---|
| Shell in-app | SVG inline con `--surface-raised`, `--border`, `--primary` y `--ink-strong` |
| Favicon / instaladores | Placa redondeada verde azulado con S de mosaico |
| Wordmark | Texto degradado `--ink-strong` → `--primary-strong` |

Regenerar recursos PNG/ICO del instalador después de cambiar la marca:

```powershell
pnpm icons:regenerate
```

## Wordmark

- Display: **Sora** (`--font-display`), peso 700, letter-spacing −0.04em
- Gradiente: `.brand-wordmark` en `src/App.css`

## Uso en código

```ts
import { BRAND_NAME, BRAND_TAGLINE, BRAND_WORKSPACE_LABEL } from './brand/identity'
import { BrandMark, BrandWordmark } from './brand/BrandMark'
```
