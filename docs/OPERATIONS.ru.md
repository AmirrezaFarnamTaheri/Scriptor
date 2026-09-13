<div dir="ltr" align="center">
[English](OPERATIONS.md) · [فارسی](OPERATIONS.fa.md) · [简体中文](OPERATIONS.zh-CN.md) · **Русский** · [Deutsch](OPERATIONS.de.md) · [Español](OPERATIONS.es.md)
</div>

# Эксплуатация и диагностика

## Структурированный tracing

Desktop, daemon и CLI инициализируют структурированный JSON tracing через `crates/system-bridge/src/observability.rs`. Поля с именами, связанными с secret/token/password/key, редактируются. Локальные файлы ротируются по размеру, а число сохраняемых сегментов ограничено.

## Корреляция

Длительные и межграничные операции должны передавать один operation/request ID через renderer command, Tauri/daemon adapter, receipt внешнего процесса и audit event. Отчёт об ошибке должен диагностироваться по этому ID без необходимости читать исходный код.

## Сигналы состояния

- generation watcher и состояние rescan-required;
- generation/актуальность index;
- потери daemon subscriber;
- результаты timeout/cancel/truncation процессов;
- ожидающие MCP intent;
- проверка backup и restore journal;
- состояние log rotation/repair.

## Сбор данных об инциденте

Используйте только редактированные diagnostic-данные. Никогда не прикладывайте реальный vault, значение keychain, полное тело request или непроверенный audit log. Сохраняйте source commit, версию приложения, OS/arch, шаги воспроизведения, operation ID и минимальный релевантный ограниченный сегмент лога.

## Support bundle

Settings → Diagnostics → **Export redacted support bundle** записывает ограниченный JSON-артефакт поддержки в `.scriptor/diagnostics/`. В пакет входят идентификация приложения/системы, агрегированные показатели здоровья vault и не более 100 уже отредактированных client diagnostic events. Корень vault, пути заметок, содержимое заметок, request bodies и credentials намеренно исключаются. Client diagnostic journal ротируется при 2 MiB, а размеры message/detail ограничиваются до записи.
