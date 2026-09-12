# Стандарт качества frontend

[English](FRONTEND_QUALITY.md) · [简体中文](FRONTEND_QUALITY.zh-CN.md) · **Русский** · [Deutsch](FRONTEND_QUALITY.de.md) · [Español](FRONTEND_QUALITY.es.md) · [فارسی](FRONTEND_QUALITY.fa.md)

Scriptor — интерфейс типа **operate**. Качество означает спокойную иерархию, быстрое выполнение задач, полные interaction states, keyboard access, responsive density и отсутствие скрытой authority, а не декоративное шоу.

## Автоматический source gate

```bash
npm run check:frontend-quality --silent
```

Gate проверяет production TypeScript/CSS на:

- explicit `any` в UI/runtime contracts;
- emoji glyphs вместо icon system;
- remote fonts/CSS imports;
- static inline styles на critical workspace surfaces;
- modal focus containment и naming;
- typed editor/preview action contracts;
- responsive editor, graph, modal и error-state CSS;
- self-contained error UI и design-system inclusion.

Package imports отдельно контролируются `lint:boundaries`.

## Визуальное направление

- нейтральная charcoal/slate основа с одним сдержанным teal accent;
- иерархия через typography, dividers, rhythm и negative space, не nested cards;
- без purple AI gradients, neon glows, gratuitous glass, generic dashboard tiles, emoji controls или ornamental perpetual motion;
- system UI fonts и system monospace; без network font dependency;
- motion только для continuity state и всегда disabled/reduced по запросу.

## Приёмка компонентов

Каждая async surface показывает loading, полезный empty, actionable error и видимый success state. Long-running work предоставляет cancellation, когда операция это поддерживает. High-risk operation раскрывает scope и consequence до native confirmation.

Dialogs требуют programmatic title/description, `aria-modal`, initial focus, focus containment, Escape, backdrop behavior, scroll containment и focus restoration. Tabs используют roving focus + Arrow/Home/End. Icon-only controls имеют accessible names.

Top-bar/toolbar overflow checks покрывают narrow viewport и 200% text zoom. Portaled menus/customization popovers остаются внутри visual viewport, закрываются Escape, восстанавливают trigger focus и обновляют position после resize/ancestor scroll. Plugin/store presets применяются как один видимый state transition, сохраняют сторонние plugin IDs, которыми не владеют, и честно показывают empty/persistence-error states.

## Обязательные визуальные доказательства

Playwright screenshot suite покрывает workspace, editor/preview, command palette, graph, canvas, Git, MCP, settings, publish, health, knowledge, conflict resolution, history, shortcuts, mobile layout, onboarding и plugins. Release reviewer должен regenerate snapshots из frozen source и проверить diffs; исторические PNG не являются доказательством текущего source state.
