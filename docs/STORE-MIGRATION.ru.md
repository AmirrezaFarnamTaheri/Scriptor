[English](STORE-MIGRATION.md) · [فارسی](STORE-MIGRATION.fa.md) · [简体中文](STORE-MIGRATION.zh-CN.md) · **Русский** · [Deutsch](STORE-MIGRATION.de.md) · [Español](STORE-MIGRATION.es.md)

# Владение store в renderer

Store владеют временным состоянием renderer, кэшами read-model, идентичностью запросов, optimistic UI и состоянием повторных попыток. Они никогда не становятся авторитетом для файлов vault, секретов, авторизации, nonce daemon или выполнения нативных jobs.

## Текущее владение

| Поверхность | Текущий владелец | Следующее выделение | Граница |
| --- | --- | --- | --- |
| Panel routing и payload | App shell и overlay hook | `usePanelRouterStore` | Нативные команды остаются вне store |
| Reader lifecycle и retry аннотаций | Reader panel и save queue | `useReaderSessionStore` | Vault sidecar — долговременный авторитет |
| Решения plugin | Backend plugin state через bridge | `useCapabilityStore` | Vault-backed state и native gates авторитетны |
| MCP discovery/drafts/audit | MCP panels и runtime hooks | `useMcpRuntimeStore` | Выполнение tools и permission checks остаются нативными |
| Git status и jobs | Git panels/hooks | `useGitWorkspaceStore` | Git process, credentials и conflict writes остаются нативными |
| Выбор конфликтов и merge preview | Git UI | `useConflictResolutionStore` | Каноническая запись Markdown остаётся на vault/native boundary |
| Task/Kanban requests | Domain panels | `useTaskBoardStore` | Request IDs отвергают устаревшие ответы; Markdown — истина |
| Export/publish plans | Export/Publish panels | `useExportJobStore`, `usePublishPlanStore` | Запуск процессов и публикация остаются native/CI |
| Navigation/history/tabs | Editor/navigation controllers | reducer-backed navigation store | Persistency editor остаётся vault-backed |

## Правило выделения

Каждое выделение начинается с падающего race/retry теста, предоставляет типизированную state machine (`idle`, `loading`, `success`, `error`, `cancelled`), несёт request/job identifier и сохраняет существующую нативную границу авторизации. Миграция store завершена только после удаления старого владельца, перевода consumers на новый контракт и устранения возможности расхождения дублированного состояния.

Текущий пакет уже содержит декомпозицию контроллеров для navigation, editor orchestration и panel surfaces. Остальные stores — намеренно поэтапные follow-up задачи, а не дублирующие providers без миграции ownership.

## Визуальные ссылки

Границы store соответствуют проверенным поверхностям в [визуальной галерее](./VISUAL-REVIEW.ru.md):

- panel routing и доступность команд: [command palette](assets/screenshots/command-palette.png)
- graph/canvas state: [Graph](assets/screenshots/graph.png) и [Canvas](assets/screenshots/canvas.png)
- Git/conflict state: [Git panel](assets/screenshots/git-panel.png) и [conflict resolver](assets/screenshots/conflict-resolver.png)
- MCP runtime: [MCP panel](assets/screenshots/mcp-panel.png)
- export/publish jobs: [Publish center](assets/screenshots/publish-center.png)
- preferences/plugin state: [Settings](assets/screenshots/settings.png) и [Plugins](assets/screenshots/plugins.png)
