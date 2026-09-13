[English](BOUNDARY_OUTCOMES.md) · [فارسی](BOUNDARY_OUTCOMES.fa.md) · [简体中文](BOUNDARY_OUTCOMES.zh-CN.md) · **Русский** · [Deutsch](BOUNDARY_OUTCOMES.de.md) · [Español](BOUNDARY_OUTCOMES.es.md)

# Контракт результата на границе

Boundary-адаптеры Scriptor используют единую алгебру из шести состояний. Это не позволяет отсутствующему optional value, повреждённому persisted state, частичному результату, ошибке выполнения и успешному восстановлению схлопнуться в одинаковое пустое/default значение.

| Статус | Контракт | Default разрешён? |
| --- | --- | --- |
| `value` | Авторитетный результат операции. | Не применимо. |
| `absent-optional` | Optional state действительно отсутствует. Caller может преобразовать это в явно документированный default/empty. | **Да, только здесь.** |
| `invalid` | Input, configuration, serialized state или persisted data некорректны. Вернуть typed code и message. | Нет. |
| `degraded` | Полезное частичное состояние доступно, warnings указывают недоступные части. | Никакого тихого default; warnings идут вместе со значением. |
| `failed` | Операция не удалась. Вернуть code, message и возможность retry/recovery. | Нет. |
| `recovered` | Операция успешна через явный recovery path. Сохранить recovery receipt. | Не стирать событие recovery молча. |

`contracts/operations.json` задаёт допустимые статусы для каждой каталогизированной Tauri-команды, daemon RPC, MCP tool и CLI command. Generated TypeScript/Rust metadata и parity checks заставляют новые элементы fail-closed до объявления boundary semantics.

## Правила адаптеров

1. Не использовать `unwrap_or_default`, `.ok()`, `filter_map(Result::ok)` или аналоги на авторитетных границах, если исходный контракт явно не представляет `absent-optional`.
2. Некорректная конфигурация vault — `invalid`, а не отсутствие.
3. Ошибки декодирования строк БД — `failed` или `degraded` с warnings, а не тихое исключение.
4. Process/IPC failures используют структурированные коды и recoverability, а не нетипизированные строки.
5. Recovery после atomic-write/journal repair — `recovered`; сохранить receipt, если граница его предоставляет.
