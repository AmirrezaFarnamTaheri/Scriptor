[English](visual-remediation-2026-09-09.md) · [فارسی](visual-remediation-2026-09-09.fa.md) · [简体中文](visual-remediation-2026-09-09.zh-CN.md) · **Русский** · [Deutsch](visual-remediation-2026-09-09.de.md) · [Español](visual-remediation-2026-09-09.es.md)

# Визуальная ремедиация — 2026-09-09

Этот checklist отслеживает второй native-vision review Windows workspace и связанных поверхностей. Он намеренно хранится в implementation branch, чтобы каждое исправление можно было внедрять и проверять поэтапно.

## P1 — информационная архитектура shell и editor

- [x] Свернуть постоянную трёхстрочную toolbar редактора в одну основную строку с progressive disclosure вторичных tools.
- [x] Удалить семантическое дублирование Source/Preview/Split и option icons.
- [x] Визуально и семантически различить active mode, toggle и моментальные commands.
- [x] Снизить плотность global top-bar и объединить duplicate entry points.
- [x] Уточнить scope глобального поиска, поиска заметок и command palette: глобальный trigger явно `Commands and notes`, sidebar — только заметки, palette объясняет начало note search.
- [x] Удалить redundant `Vault`/recent-note navigation и уточнить utility actions sidebar.
- [x] Уменьшить chrome split-mode и сохранить рабочие ширины editor/preview.
- [x] Упростить двухуровневый нижний status/output chrome; убрать duplicate Jobs и шум завершённого progress.
- [x] Поднять реальные проблемы выше пассивного subsystem status.

## P1 — доверие, состояние и именование

- [x] Согласовать citation metrics Inspector и различить note-level/vault-level metrics.
- [x] Заменить пересекающиеся Note Health / Note quality на vault-scoped health и note-scoped Publish readiness.
- [x] Устранить коллизию Preview между mode editor и inspector tab (`Rendered output`).
- [x] Сделать Inspector profiles single-choice и показывать описание без tooltip.
- [x] Исправить терминологию Publish Center, разделить profile label/path и иерархию export actions.
- [x] Сделать onboarding state-aware и не предлагать заблокированные background controls.
- [x] Заменить неоднозначную merge-терминологию и требовать явного hunk resolution до apply.

## P2 — отдельные поверхности

- [x] Переработать Settings в навигационные секции с явной моделью сохранения и меньшим implementation jargon.
- [x] Отделить управление installed plugins/permissions от marketplace browsing, сохранив четыре top-level Store tabs в одной строке.
- [x] Показывать MCP authorization levels как security states, а не обычные tabs, и уточнить vault scope.
- [x] Превратить healthy Vault Health в положительный summary и понизить maintenance actions.
- [x] Сделать Note History comparison-first/restore-second с едиными timestamps и fail-closed preview reads.
- [x] Позитивные, не повторяющиеся empty states Knowledge Workbench.
- [x] Улучшить Graph direction, reciprocal edges, focus labels, controls, keyboard navigation и canvas utilization.
- [x] Упростить Git rail actions, status wording, pull strategy, confirmations и commit hierarchy.
- [x] Сделать conflict resolver diff-first, стабильно закрываемым и safe-by-default.
- [x] Уточнить command palette categories, shortcut alignment и consequential actions.
- [x] Дать пустому Canvas очевидное первое действие; понизить export controls до появления контента и убрать developer CLI leakage.
- [x] Реализовать отдельную поверхность управления keyboard shortcuts.

## P2 — accessibility, responsive, themes, localization

- [x] Сохранить 44px coarse-pointer targets через финальный CSS cascade.
- [x] Проверить keyboard semantics Canvas, graph, toolbar menus, virtualized Git rows и security-state controls.
- [x] Проверить dark mode всех dialog/panel. Автопокрытие: Settings, MCP, Graph, Knowledge Workbench, Note History, Canvas, Plugins, Git/conflicts, Export & publish, Vault Health и onboarding, с явными dark-surface assertions.
- [x] Завершить visual matrix для Windows scaling, long names, large data, loading/error и destructive confirmations. Покрытие включает Windows visual regression, 125% device scale/app zoom, compact/mobile/tablet, крупные virtualized vaults, slow-loading skeletons, editor/preview failures, destructive confirmations, Persian RTL и German expansion.
- [x] Удалить hard-coded implementation/theme colors там, где нужны semantic tokens. Финальный sweep перевёл chrome, status colors, editor warnings, reader surfaces, error overlays и primary-action foregrounds на semantic/theme tokens. Оставшиеся literals — намеренные palette definitions, user/content colors, export/print colors, visualization/category palettes или fallback за semantic variables.

## Проблемы корректности и доверия из detour

- [x] Удалить heuristic merge-ancestor reconstruction и fail-closed для unresolved/incomplete conflict blocks.
- [x] Исправить initial-vault refresh, читавший stale React state сразу после `setVault`.
- [x] Least-privilege plugin consent: по умолчанию только required permissions, additive grants per-vault и vault-scoped revoke.
- [x] Сериализовать mutation vault config и сохранять runtime-owned MCP state при Settings saves.
- [x] Направить LanguageTool через поддерживаемый desktop network path и показывать service failures.
- [x] Единообразно рендерить extended task states с parser.
- [x] Отключать Note History restore, если selected revision или current-note comparison не читается.
- [x] Экспонировать Git pull strategy native layer вместо hard-coded fast-forward.

## Верификация

Каждый отмеченный пункт имеет минимум одно доказательство: focused unit/component test, E2E assertion, accessibility assertion или visual contract. Screenshot tests ужесточаются, чтобы отсутствующая feature падала, а не молча снимала fallback.

Последний recovery pass также удалил вторую UI-authority `splitPreview`: `chrome.editorSurfaceMode` теперь управляет Source/Split/Rendered, presets/toggles проходят через неё, Inspector получает тот же effective state. E2E workspace-chrome fixtures используют production versioned-storage envelope, поэтому custom-layout тесты больше не откатываются молча к default chrome. Одновременно исправлены stale accessible-name и слишком широкие locators.

Временный branch-only write workflow для атомарного применения крупного cross-file recovery удалил себя после успешного commit; он не является частью предлагаемой product/CI surface.

PR остаётся draft, пока current-head CI, desktop compile и visual review не станут зелёными и все оставшиеся пункты не будут выполнены либо явно вынесены в follow-up с evidence.
