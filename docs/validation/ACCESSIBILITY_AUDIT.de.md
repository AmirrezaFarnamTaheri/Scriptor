# Accessibility-Audit

[English](ACCESSIBILITY_AUDIT.md) · [简体中文](ACCESSIBILITY_AUDIT.zh-CN.md) · [Русский](ACCESSIBILITY_AUDIT.ru.md) · **Deutsch** · [Español](ACCESSIBILITY_AUDIT.es.md) · [فارسی](ACCESSIBILITY_AUDIT.fa.md)

Release-Checkliste für Scriptor Desktop. Automatische statische Prüfungen laufen über `pnpm check:a11y`; unten ist markiert, was CI abdeckt und was vor Tagging manuell spot-geprüft werden muss.

## Tastatur

- [ ] Tab-Reihenfolge erreicht Vault Search, Note List, Editor, Inspector Tabs und Status Controls ohne Traps *(manual release gate)*.
- [x] `Escape` schließt Graph Panel, Rename Dialog, Diagnostics Drawer, Git Panel und andere Modal Overlays (`useEscapeToClose`).
- [x] Shared Panels, Graph und Obsidian Import halten Focus im Modal und stellen vorherigen Focus beim Schließen wieder her (`useFocusTrap`).
- [x] Note Tabs haben getrennte Activate-, Pin- und Close-Controls ohne verschachtelte interaktive Elemente; Arrow/Home/End wird unterstützt.
- [x] Editor akzeptiert Standard-Texteingabe; CodeMirror Focus Ring nutzt `--focus-ring` / `--focus-outline` Tokens.
- [x] Icon Buttons in Toolbars und Close Buttons besitzen `aria-label` (Spot-Check in Shell Components).

## Landmarks und Namen

- [x] `main` Shell ist über `BRAND_WORKSPACE_LABEL` benannt *(durch `check:a11y` geprüft)*.
- [x] Vault-, Editor- und Inspector-Regionen verwenden `aria-label` oder Headings.
- [x] Inspector- und Note-Tabs nutzen `role="tablist"` / `role="tab"` mit `aria-selected`.
- [x] Status Banners verwenden `role="status"` oder `role="alert"` für Fehler *(durch `check:a11y` geprüft)*.

## Visuell

- [ ] Textkontrast erfüllt WCAG AA im Default Dark Theme *(manual spot-check)*.
- [x] Focus Indicators sind in `src/index.css` definiert *(durch `check:a11y` geprüft)*.
- [x] `prefers-reduced-motion` wird respektiert; Application CSS deaktiviert nicht essentielle Animationen.

## Screen Reader (Spot Check)

- [x] Vault Note Count und Index Progress werden über Status Region angekündigt.
- [ ] Problems Tab Issue Count *(manuell mit Screen Reader)*.
- [x] Diagnostics Opt-in Checkbox trägt das Label “Send local crash diagnostics”.

## Automatisierte Helfer

```powershell
pnpm check:a11y
```

Static Source Checks laufen in CI/Release Gates. Für Browser Coverage:

```powershell
pnpm dev --host 127.0.0.1
pnpm check:a11y-axe
pnpm test:visual
```

Findings im Release PR dokumentieren. Keyboard Traps, fehlende Namen primärer Aktionen, Focus Loss, unlesbarer Kontrast und critical/serious axe violations blockieren den Release.

## Bekannte Einschränkungen (v0.1)

- Graph Panel verwendet eine Keyboard Focus Surface mit Arrow Navigation, Enter Activation, Live Node Summary und Modal Focus Containment. Ein Screen-Reader Usability Pass bleibt manuelles Release Gate.
- Command Palette unterstützt Arrow Keys, Enter und Escape (`CommandPalette.tsx`).
