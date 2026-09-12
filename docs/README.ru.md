# Документация Scriptor

[English](README.md) · [فارسی](README.fa.md) · [简体中文](README.zh-CN.md) · **Русский** · [Deutsch](README.de.md) · [Español](README.es.md)

> Английская документация является каноническим источником. Этот перевод предназначен для естественного и точного чтения; код, команды, пути, имена API и идентификаторы контрактов остаются без изменений.

## Авторитетные документы о текущем состоянии

| Документ | Назначение |
|---|---|
| [`../README.ru.md`](../README.ru.md) | обзор, установка, проверка и состояние релиза |
| [`ARCHITECTURE.ru.md`](ARCHITECTURE.ru.md) | runtime-топология, владение, границы доверия и отказов |
| [`CAPABILITY-MATURITY.ru.md`](CAPABILITY-MATURITY.ru.md) | статус выпущенных, экспериментальных, оцениваемых и design-only возможностей |
| [`../PRODUCT.ru.md`](../PRODUCT.ru.md) | пользовательские результаты, обещания продукта и исключения |
| [`../DESIGN.ru.md`](../DESIGN.ru.md) | UI-система, адаптивность и доступность |
| [`../SECURITY.ru.md`](../SECURITY.ru.md) | границы безопасности и политика сообщения об уязвимостях |
| [`RELEASE-SECURITY.ru.md`](RELEASE-SECURITY.ru.md) | подпись, SBOM, provenance и пользовательская проверка |
| [`ENCRYPTION-THREAT-MODEL.ru.md`](ENCRYPTION-THREAT-MODEL.ru.md) | критерии допуска экспериментального шифрования |
| [`OPERATIONS.ru.md`](OPERATIONS.ru.md) | tracing, корреляция, здоровье и инциденты |
| [`FINAL-REMEDIATION-REPORT.ru.md`](FINAL-REMEDIATION-REPORT.ru.md) | текущая базовая линия продукта v1, schema и релиза |
| [`VERIFICATION.ru.md`](VERIFICATION.ru.md) | executed/static/pending/release/history proof gates |
| [`RELEASE-CHECKLIST.ru.md`](RELEASE-CHECKLIST.ru.md) | production go/no-go checklist |

## Руководства для пользователей и участников

- [`guides/GETTING_STARTED.ru.md`](guides/GETTING_STARTED.ru.md)
- [`CAPABILITIES.ru.md`](CAPABILITIES.ru.md)
- [`../CONTRIBUTING.ru.md`](../CONTRIBUTING.ru.md)
- [`plugins/AUTHOR_GUIDE.ru.md`](plugins/AUTHOR_GUIDE.ru.md)
- [`contracts/COMMAND_CATALOG.ru.md`](contracts/COMMAND_CATALOG.ru.md)
- [`contracts/CONTRACT_INDEX.ru.md`](contracts/CONTRACT_INDEX.ru.md)
- [`contracts/CONTRACT_GOVERNANCE.ru.md`](contracts/CONTRACT_GOVERNANCE.ru.md)

## Дизайн и валидация

- [`design/DESIGN_SYSTEM.ru.md`](design/DESIGN_SYSTEM.ru.md)
- [`design/LAYOUT_BLUEPRINTS.ru.md`](design/LAYOUT_BLUEPRINTS.ru.md)
- [`validation/ACCESSIBILITY_AUDIT.ru.md`](validation/ACCESSIBILITY_AUDIT.ru.md)
- [`validation/FRONTEND_QUALITY.ru.md`](validation/FRONTEND_QUALITY.ru.md)
- [`assets/screenshots/README.ru.md`](assets/screenshots/README.ru.md)

## Архитектурные материалы

| Файл | Область |
|---|---|
| [`ARCHITECTURE.ru.md`](ARCHITECTURE.ru.md) | runtime-топология, владение, доверие и границы отказов |
| [`architecture/c4-container.ru.md`](architecture/c4-container.ru.md) | runtime-диаграмма уровня Container (Mermaid) |
| [`architecture/c4-context.ru.md`](architecture/c4-context.ru.md) | Context-диаграмма (Mermaid) |
| [`architecture/IPC_DAEMON.ru.md`](architecture/IPC_DAEMON.ru.md) | RPC-поверхность daemon, инварианты и валидация |
| [`architecture/PLUGIN_SYSTEM.ru.md`](architecture/PLUGIN_SYSTEM.ru.md) | manifest плагина, safe mode, marketplace и авторинг |
| [`architecture/PERFORMANCE_ARCHITECTURE.ru.md`](architecture/PERFORMANCE_ARCHITECTURE.ru.md) | уровни оптимизации, владельцы и бюджеты производительности |
| [`architecture/TUI_PARITY.ru.md`](architecture/TUI_PARITY.ru.md) | модель функционального паритета TTY TUI с desktop-поверхностью |

Все заявления о возможностях в этих файлах должны соответствовать [`CAPABILITY-MATURITY.ru.md`](CAPABILITY-MATURITY.ru.md). Дизайн-документ сам по себе не доказывает, что функция поставляется.

## Архивные материалы

Исследования до v1 и заменённые оценки дизайна сохранены в [`_archived/`](_archived/) для исторической справки и не входят в текущий контракт продукта или активную область локализации.

## Материалы о релизах

- [`release/SIGNING.ru.md`](release/SIGNING.ru.md)
- [`release/PANDOC_STRATEGY.ru.md`](release/PANDOC_STRATEGY.ru.md)
