# Аудит доступности

[English](ACCESSIBILITY_AUDIT.md) · [简体中文](ACCESSIBILITY_AUDIT.zh-CN.md) · **Русский** · [Deutsch](ACCESSIBILITY_AUDIT.de.md) · [Español](ACCESSIBILITY_AUDIT.es.md) · [فارسی](ACCESSIBILITY_AUDIT.fa.md)

Release checklist для десктопного Scriptor. Автоматические статические проверки запускаются через `pnpm check:a11y`; ниже отмечено, что покрывает CI и что требует ручной spot-check перед тегированием.

## Клавиатура

- [ ] Tab order достигает vault search, note list, editor, inspector tabs и status controls без ловушек. *(manual release gate)*
- [x] `Escape` закрывает graph panel, rename dialog, diagnostics drawer, Git panel и другие modal overlays (`useEscapeToClose`).
- [x] Shared panels, graph и Obsidian import удерживают focus внутри modal и восстанавливают прежний focus после закрытия (`useFocusTrap`).
- [x] Note tabs предоставляют отдельные activate/pin/close controls без вложенных interactive elements; поддержаны Arrow/Home/End.
- [x] Editor принимает стандартный text input; focus ring CodeMirror использует токены `--focus-ring` / `--focus-outline`.
- [x] Icon buttons в toolbars и close buttons имеют `aria-label` (spot-check shell components).

## Landmarks и names

- [x] `main` shell имеет label через `BRAND_WORKSPACE_LABEL` *(проверяется `check:a11y`)*.
- [x] Vault, editor и inspector regions используют `aria-label` или headings.
- [x] Inspector и note tabs используют `role="tablist"` / `role="tab"` с `aria-selected`.
- [x] Status banners используют `role="status"` или `role="alert"` для ошибок *(проверяется `check:a11y`)*.

## Визуальная доступность

- [ ] Контраст текста соответствует WCAG AA в default dark theme *(ручной spot-check)*.
- [x] Focus indicators определены в `src/index.css` *(проверяется `check:a11y`)*.
- [x] `prefers-reduced-motion` соблюдается: CSS приложения отключает необязательную анимацию.

## Screen reader (spot check)

- [x] Vault note count и index progress объявляются status region.
- [ ] Problems tab issue count *(ручная проверка screen reader)*.
- [x] Diagnostics opt-in checkbox имеет label “Send local crash diagnostics”.

## Автоматизированные помощники

```powershell
pnpm check:a11y
```

Статические source checks работают в CI/release gates. Для browser coverage:

```powershell
pnpm dev --host 127.0.0.1
pnpm check:a11y-axe
pnpm test:visual
```

Фиксируйте findings в release PR. Keyboard traps, отсутствующие names у primary actions, потеря focus, нечитаемый contrast и critical/serious axe violations блокируют release.

## Известные ограничения (v0.1)

- Graph panel использует одну keyboard focus surface с arrow navigation, Enter activation, live node summary и modal focus containment. Screen-reader usability pass остаётся ручным release gate.
- Command palette поддерживает arrow keys, Enter и Escape (`CommandPalette.tsx`).
