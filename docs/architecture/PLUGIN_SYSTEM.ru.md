# Проектирование системы плагинов

[English](PLUGIN_SYSTEM.md) · [简体中文](PLUGIN_SYSTEM.zh-CN.md) · **Русский** · [Deutsch](PLUGIN_SYSTEM.de.md) · [Español](PLUGIN_SYSTEM.es.md) · [فارسی](PLUGIN_SYSTEM.fa.md)

![Marketplace плагинов и установленные плагины](../assets/screenshots/plugins.png)

## Цели

- Позволить Scriptor развиваться, не превращая ядро приложения в открытую неконтролируемую поверхность.
- Защитить файлы и записи в vault контрактами команд.
- Позволить first-party и встроенным marketplace-расширениям добавлять команды, поведение renderer, export profiles, MCP tools, inspector widgets, проверки здоровья vault, canvas tools, blocks и template packs.
- Сделать каждое разрешение видимым и отзывным.

## Не-цели

- В первой версии нет прямого доступа плагина к файловой системе.
- Нет фоновых daemon, которыми управляет плагин.
- Нет непроверенных MCP write tools.

## Runtime-модель плагина

```text
Plugin manifest
  -> permission review
  -> activation policy
  -> contribution registry
  -> command bus / renderer / export / MCP slots
  -> audit events
```

Плагины добавляют поведение через slots:

| Slot | Возможность | Минимальное разрешение |
|---|---|---|
| Command | Command palette и automation action. | `read` |
| Renderer extension | Преобразование Markdown preview. | `read` |
| Export profile | Новая цель экспорта или шаблон. | `system` |
| MCP tool | AI/tooling interface. | `read` |
| Inspector widget | Виджет note/vault в правой панели. | `read` |
| Vault health check | Правило диагностики. | `read` |
| Canvas tool | Действие toolbar бескрайнего canvas. | `read` |
| Canvas block | Зарегистрированный renderer block для canvas mode. | `read` |
| Template pack | Начальные layouts документа или canvas. | `read` |

## Модель разрешений

| Разрешение | Значение |
|---|---|
| `read` | Может запрашивать одобренные command contracts. |
| `write-approved` | Может предлагать записи, требующие подтверждения. |
| `system` | Может использовать производные cache/jobs без изменения canonical files. |
| `dangerous` | Требует явного предупреждения при установке и подтверждения при выполнении. |
| `network` | По умолчанию заблокировано, разрешается allowlist хостов. |
| `secrets` | Доступ только через именованные keychain handles. |
| `external-process` | Отключено, пока не существует plugin sandbox policy. |

## Кандидаты first-party плагинов

| Плагин | Ценность | Slots |
|---|---|---|
| `scriptor-citation-tools` | CSL, bibliography, проверки отсутствующих citations. | inspector widget, health check, export profile |
| `scriptor-graph-lens` | Расширенные фильтры graph и отчёты о центральности заметок. | inspector widget, command |
| `scriptor.publish-pack` | Publication templates и export profiles. | export profile, renderer extension |
| `scriptor-vault-lint` | Правила для broken links, invalid frontmatter и stale notes. | health check, command |
| `scriptor-mcp-research` | Read-only инструменты исследовательского помощника. | MCP tool, command |
| `scriptor.canvas-kit` | Sticky notes, shapes, connectors и templates исследовательских досок. | canvas tool, canvas block, template pack |

## Safety gates

- Manifest плагина проходит schema validation до загрузки.
- Изменение разрешений требует подтверждения пользователя.
- Команды плагина идут через тот же command bus, что UI и CLI.
- Widgets получают scoped data и никогда не получают raw vault handles.
- Renderer extensions получают очищенные extension inputs.
- Сбой плагина отключает его, не обрушая shell приложения.
- Safe mode запускается со всеми отключёнными плагинами.

## Поставляемые возможности

| Возможность | Расположение |
|---|---|
| Manifest schema | `@scriptor/core/contracts/plugin` |
| Contribution registry + safe mode | `packages/plugin-api` |
| Встроенный marketplace catalog | `packages/plugin-api/catalog.json`, `src/marketplace.ts` |
| Remote catalog merge | `loadMarketplaceCatalog` (`VITE_SCRIPTOR_PLUGIN_MARKETPLACE_URL`) |
| First-party plugins | `scriptor-vault-lint`, `scriptor.canvas-kit`, `scriptor.publish-pack` |
| Plugin panel UI | `src/components/PluginPanel.tsx` |
| MCP read-only plugin slot | `packages/mcp` |
