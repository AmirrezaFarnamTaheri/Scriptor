[English](SHARING_AND_SYNC.md) · [فارسی](SHARING_AND_SYNC.fa.md) · [简体中文](SHARING_AND_SYNC.zh-CN.md) · **Русский** · [Deutsch](SHARING_AND_SYNC.de.md) · [Español](SHARING_AND_SYNC.es.md)

# Общий доступ и синхронизация

Scriptor инвентаризирует локальные ресурсы агентов и из desktop-приложения синхронизирует проверенные skills между поддерживаемыми приложениями, IDE и CLI.

## Модель доверия

Обнаружение и изменение — разные операции. Само наличие каталога конфигурации никогда не подтверждает установку приложения. Требуется минимум один ограниченный сигнал идентичности:

- executable, разрешённый в конкретный путь, успешно прошедший bounded version probe и имеющий записанный SHA-256 hash;
- известный бинарник установленного приложения с записанным hash; или
- установленное расширение редактора, у которого точные publisher и extension identifier совпадают с metadata пакета.

Каждый найденный ресурс хранит physical target, scope, canonical path, manifest path, ownership marker, validation issues и нормализованный content fingerprint. Невалидные ресурсы остаются видимыми, но не могут быть источниками синхронизации.

## Уровни поддержки

- **Native:** AgentStack, Claude Code, Codex и vendor-neutral каталог Agent Skills.
- **Compatible:** цели с документированными каталогами skills; сейчас Visual Studio Code и Copilot, Windsurf, Zed, Gemini CLI и OpenCode.
- **Inventory only:** найденные продукты без достаточно стабильного документированного write contract. Scriptor показывает доказательства, но не изменяет файлы.

Уровень поддержки и факт установки независимы. Поддерживаемая цель доступна для записи только после подтверждения identity приложения, кроме явно нейтральной библиотеки `~/.agents/skills`.

## Планы и выполнение

Синхронизация и дедупликация всегда начинаются с неизменяемого плана. План:

- привязан к полному fingerprint инвентаря;
- содержит ожидаемые source/destination fingerprints;
- истекает по ограниченному сроку `PLAN_TTL_MS`;
- потребляется один раз;
- объединяет несколько выбранных продуктов с одним physical destination в одну операцию;
- до изменения отклоняет пересекающиеся destinations; и
- требует нативной одноразовой авторизации, ограниченной identifier плана.

Независимые destinations могут выполняться параллельно с ограниченным числом workers. В каждый момент ресурсы изменяет только один план. Frontend получает структурированный progress и receipts, но никогда сырой stdout/stderr процесса.

## Дедупликация

Scriptor различает:

- **Exact mirror:** идентичный контент, намеренно установленный для разных targets/scopes.
- **Redundant:** идентичный контент, повторённый внутри одного target/scope.
- **Diverged:** одна логическая identity с различным контентом.

Только redundant exact copies могут породить автоматический план дедупликации. Копия перемещается в recovery quarantine Scriptor и проверяется по hash; она не удаляется навсегда. Mirrors сохраняются, diverged resources требуют ручного merge-решения.

## Восстановление

Обновления сначала staging/hash replacement перед promotion. Существующий контент сначала перемещается в recovery quarantine. Если promotion или post-write verification не проходит, Scriptor пытается восстановить предыдущий контент и возвращает структурированный failure receipt.
