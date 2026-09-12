# Auditoría de accesibilidad

[English](ACCESSIBILITY_AUDIT.md) · [简体中文](ACCESSIBILITY_AUDIT.zh-CN.md) · [Русский](ACCESSIBILITY_AUDIT.ru.md) · [Deutsch](ACCESSIBILITY_AUDIT.de.md) · **Español** · [فارسی](ACCESSIBILITY_AUDIT.fa.md)

Lista de verificación de release para Scriptor desktop. Los checks estáticos automáticos se ejecutan con `pnpm check:a11y`; los elementos siguientes indican qué cubre CI y qué requiere spot-check manual antes del tag.

## Teclado

- [ ] El orden de Tab alcanza vault search, note list, editor, inspector tabs y status controls sin traps *(manual release gate)*.
- [x] `Escape` cierra graph panel, rename dialog, diagnostics drawer, Git panel y otros modal overlays (`useEscapeToClose`).
- [x] Shared panels, graph y Obsidian import contienen el focus mientras son modales y restauran el anterior al cerrar (`useFocusTrap`).
- [x] Note tabs exponen controles separados de activate, pin y close sin interactive elements anidados; se admite Arrow/Home/End.
- [x] Editor acepta text input estándar; el focus ring de CodeMirror usa tokens `--focus-ring` / `--focus-outline`.
- [x] Icon buttons exponen `aria-label` en toolbars y close buttons (spot-check en shell components).

## Landmarks y nombres

- [x] Shell `main` etiquetada con `BRAND_WORKSPACE_LABEL` *(verificado por `check:a11y`)*.
- [x] Regiones Vault, editor e inspector usan `aria-label` o headings.
- [x] Inspector y note tabs usan `role="tablist"` / `role="tab"` con `aria-selected`.
- [x] Status banners usan `role="status"` o `role="alert"` para errores *(verificado por `check:a11y`)*.

## Visual

- [ ] Contraste de texto cumple WCAG AA en default dark theme *(spot-check manual)*.
- [x] Focus indicators definidos en `src/index.css` *(verificado por `check:a11y`)*.
- [x] Se respeta `prefers-reduced-motion`; CSS desactiva animaciones no esenciales.

## Screen reader (spot check)

- [x] Vault note count e index progress se anuncian mediante status region.
- [ ] Problems tab issue count *(manual con screen reader)*.
- [x] Diagnostics opt-in checkbox etiquetado “Send local crash diagnostics”.

## Ayudas automáticas

```powershell
pnpm check:a11y
```

Static source checks se ejecutan en CI/release gates. Para browser coverage:

```powershell
pnpm dev --host 127.0.0.1
pnpm check:a11y-axe
pnpm test:visual
```

Documente findings en el release PR. Keyboard traps, nombres ausentes en primary actions, pérdida de focus, contraste ilegible y critical/serious axe violations bloquean el release.

## Limitaciones conocidas (v0.1)

- Graph panel usa una keyboard focus surface con arrow navigation, Enter activation, live node summary y modal focus containment. El screen-reader usability pass sigue siendo manual release gate.
- Command palette admite arrow keys, Enter y Escape (`CommandPalette.tsx`).
