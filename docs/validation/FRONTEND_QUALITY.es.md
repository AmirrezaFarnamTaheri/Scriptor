# Estándar de calidad frontend

[English](FRONTEND_QUALITY.md) · [简体中文](FRONTEND_QUALITY.zh-CN.md) · [Русский](FRONTEND_QUALITY.ru.md) · [Deutsch](FRONTEND_QUALITY.de.md) · **Español** · [فارسی](FRONTEND_QUALITY.fa.md)

Scriptor es una interfaz de **operación**. Calidad significa jerarquía calmada, finalización rápida de tareas, estados de interacción completos, acceso por teclado, densidad responsive y ninguna autoridad oculta; no espectáculo decorativo.

## Source gate automatizado

```bash
npm run check:frontend-quality --silent
```

El gate revisa TypeScript/CSS de production para detectar:

- `any` explícito en contratos UI/runtime;
- glyphs emoji usados en lugar del icon system;
- remote fonts/CSS imports;
- static inline styles en critical workspace surfaces;
- modal focus containment y naming;
- typed editor/preview action contracts;
- CSS responsive de editor, graph, modal y error-state;
- self-contained error UI e inclusión del design system.

Los package imports se fuerzan aparte con `lint:boundaries`.

## Dirección visual

- base neutral charcoal/slate con un solo teal accent contenido;
- jerarquía mediante typography, dividers, rhythm y negative space, no nested cards;
- sin purple AI gradients, neon glows, glass gratuito, generic dashboard tiles, emoji controls ni ornamental perpetual motion;
- system UI fonts y system monospace, sin dependencia de network font;
- motion solo para continuidad de estado y siempre disabled/reduced cuando se solicita.

## Aceptación de componentes

Cada async surface debe mostrar loading, empty útil, error accionable y success visible. Long-running work expone cancellation cuando la operación subyacente lo permite. High-risk operations explican scope y consecuencia antes de native confirmation.

Dialogs requieren programmatic title/description, `aria-modal`, initial focus, focus containment, Escape, backdrop behavior, scroll containment y focus restoration. Tabs usan roving focus + Arrow/Home/End. Icon-only controls tienen accessible names.

Top-bar/toolbar overflow checks cubren narrow viewports y 200% text zoom. Portaled menus/customization popovers deben permanecer dentro del visual viewport, cerrar con Escape, restaurar trigger focus y actualizar posición después de resize/ancestor scrolling. Plugin/store presets deben aplicarse como una sola transición visible de estado, preservar third-party plugin IDs no propios y exponer estados honestos empty/persistence-error.

## Evidencia visual obligatoria

La suite de screenshots Playwright cubre workspace, editor/preview, command palette, graph, canvas, Git, MCP, settings, publish, health, knowledge, conflict resolution, history, shortcuts, mobile layout, onboarding y plugins. El release reviewer debe regenerar snapshots desde frozen source e inspeccionar diffs; PNGs históricos no demuestran el source state actual.
