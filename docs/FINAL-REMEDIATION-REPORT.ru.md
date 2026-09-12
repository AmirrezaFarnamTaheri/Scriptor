# Базовая линия продукта V1

**Версия продукта:** отслеживается в [`VERSION`](../VERSION)  
**Контракт:** один текущий источник, API и schema постоянного состояния.

## Граница продукта

Scriptor v1 определяет единственный источник полномочий для каждой долговечной области:

- vault владеет содержимым, решениями по capability, audit records и данными восстановления;
- native adapters проверяют и авторизуют каждую filesystem-, process-, IPC- и capability-sensitive операцию;
- renderer владеет только presentation state, жизненным циклом request и кэшированными read models;
- package contracts точно определяют интерфейсы renderer, desktop, daemon, CLI, MCP и plugin.

Постоянные browser-данные должны использовать текущий проверенный envelope. Неверные или устаревшие значения помещаются в quarantine и никогда не интерпретируются как живое состояние. Plugin state хранится в vault. Canvas storage использует canonical identifiers и отвергает noncanonical файлы.

## Требования к релизу V1

Релиз допустим только тогда, когда точный source head прошёл применимые проверки locked dependencies, Rust, browser, accessibility, desktop, artifacts и recovery из [`VERIFICATION.ru.md`](VERIFICATION.ru.md). Release artifacts должны собираться из неизменяемого тега `v1.0.0` и быть привязаны к checksum, SBOM, receipts и GitHub attestations согласно [`RELEASE-SECURITY.ru.md`](RELEASE-SECURITY.ru.md).

Экспериментальные возможности остаются за пределами заявлений о поддерживаемом продукте, пока не выполнят graduation requirements из [`CAPABILITY-MATURITY.ru.md`](CAPABILITY-MATURITY.ru.md).

## Гигиена репозитория

Поставляемое дерево содержит только актуальную документацию продукта и операторов. Устаревшие планы, review packets, forensic snapshots и исторические записи changelog намеренно не входят в контракт v1.
