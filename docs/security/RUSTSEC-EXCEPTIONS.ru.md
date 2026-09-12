[English](RUSTSEC-EXCEPTIONS.md) · [فارسی](RUSTSEC-EXCEPTIONS.fa.md) · [简体中文](RUSTSEC-EXCEPTIONS.zh-CN.md) · **Русский** · [Deutsch](RUSTSEC-EXCEPTIONS.de.md) · [Español](RUSTSEC-EXCEPTIONS.es.md)

# Реестр исключений RustSec

Этот реестр является владельцем каждого advisory, временно игнорируемого `cargo-deny`. Ignore не означает отклонение: он документирует проверенное достижимое ограничение зависимости с назначенным владельцем, датой повторной проверки и конкретным условием выхода. Уязвимости, которые можно обновить, по-прежнему запрещены CI.

**Владелец:** сопровождающие release/security Scriptor  
**Периодичность:** ежемесячно и перед каждым production tag  
**Последняя полная проверка:** 2026-09-03  
**Следующая полная проверка:** 2026-10-01

### Доказательства проверки 2026-09-03

- Игнорируемые advisories GTK3/Tauri, `proc-macro-error`, `atomic-polyfill`, `paste` и `rust-unic` остаются RustSec **INFO / unmaintained** без исправленных версий. Locked packages всё ещё нужны, потому что поддерживаемый Tauri/Linux или transitive product graph в этом checkout не имеет совместимой поддерживаемой замены.
- `RUSTSEC-2025-0057` (`fxhash`) удалён из реестра и `deny.toml`: `fxhash` больше отсутствует в `Cargo.lock`; сохранение исключения скрывало бы будущую повторную зависимость вместо документирования текущей достижимости.
- Проверка не подавляет новые vulnerabilities. `cargo deny` остаётся production-authority для advisories вне точного списка; следующая production-capable среда обязана запустить его на актуальной advisory database до tagging.

### Follow-up интеграционного аудита 2026-09-05

Свежая RustSec database не выявила vulnerability-class advisories, но показала 18 unmaintained packages и информационные unsoundness advisories для `glib` и двух `lru`. TUI dependency обновлена с `lru` 0.18.1 до исправленной 0.18.2. Tantivy 0.26.1 по-прежнему разрешает `lru` 0.16.4; совместимый replacement отсутствует. Linux Tauri stack остаётся на `glib` 0.18.5, затронутом RUSTSEC-2024-0429. Эти два unsoundness finding **не** добавлены в ignore list. Они остаются upstream dependency work и должны быть оценены до production release. Проверка yanked versions была отключена, поэтому аудит не доказывает отсутствие yanked releases в lockfile.

| Advisory | Семейство dependency | Достижимость | Owner | Upstream | Проверить до | Условие выхода |
|---|---|---|---|---|---|---|
| RUSTSEC-2024-0370 | GTK/Tauri Linux desktop stack | Linux desktop packaging/runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0370.html | 2026-10-01 | Удалить, когда Tauri/WebKitGTK перестанет разрешать затронутый unmaintained crate |
| RUSTSEC-2024-0411 | GTK/Tauri Linux desktop stack | Linux desktop packaging/runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0411.html | 2026-10-01 | Удалить при появлении поддерживаемой замены в поддерживаемом Tauri Linux stack |
| RUSTSEC-2024-0412 | GTK/Tauri Linux desktop stack | Linux desktop packaging/runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0412.html | 2026-10-01 | Удалить при появлении поддерживаемой замены в поддерживаемом Tauri Linux stack |
| RUSTSEC-2024-0413 | GTK/Tauri Linux desktop stack | Linux desktop packaging/runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0413.html | 2026-10-01 | Удалить при появлении поддерживаемой замены в поддерживаемом Tauri Linux stack |
| RUSTSEC-2024-0414 | GTK/Tauri Linux desktop stack | Linux desktop packaging/runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0414.html | 2026-10-01 | Удалить при появлении поддерживаемой замены в поддерживаемом Tauri Linux stack |
| RUSTSEC-2024-0415 | GTK/Tauri Linux desktop stack | Linux desktop packaging/runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0415.html | 2026-10-01 | Удалить при появлении поддерживаемой замены в поддерживаемом Tauri Linux stack |
| RUSTSEC-2024-0416 | GTK/Tauri Linux desktop stack | Linux desktop packaging/runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0416.html | 2026-10-01 | Удалить при появлении поддерживаемой замены в поддерживаемом Tauri Linux stack |
| RUSTSEC-2024-0417 | GTK/Tauri Linux desktop stack | Linux desktop packaging/runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0417.html | 2026-10-01 | Удалить при появлении поддерживаемой замены в поддерживаемом Tauri Linux stack |
| RUSTSEC-2024-0418 | GTK/Tauri Linux desktop stack | Linux desktop packaging/runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0418.html | 2026-10-01 | Удалить при появлении поддерживаемой замены в поддерживаемом Tauri Linux stack |
| RUSTSEC-2024-0419 | GTK/Tauri Linux desktop stack | Linux desktop packaging/runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0419.html | 2026-10-01 | Удалить при появлении поддерживаемой замены в поддерживаемом Tauri Linux stack |
| RUSTSEC-2024-0420 | GTK/Tauri Linux desktop stack | Linux desktop packaging/runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0420.html | 2026-10-01 | Удалить при появлении поддерживаемой замены в поддерживаемом Tauri Linux stack |
| RUSTSEC-2023-0089 | Transitive product dependency | Product graph; безопасный compatible upgrade не зафиксирован | Release/Security | https://rustsec.org/advisories/RUSTSEC-2023-0089.html | 2026-10-01 | Удалить при patched parent release или заменить parent dependency |
| RUSTSEC-2024-0436 | Transitive product dependency | Product graph; безопасный compatible upgrade не зафиксирован | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0436.html | 2026-10-01 | Удалить при patched parent release или заменить parent dependency |
| RUSTSEC-2025-0075 | `rust-unic` через Tauri `urlpattern` | Desktop URL-pattern parsing | Release/Security | https://rustsec.org/advisories/RUSTSEC-2025-0075.html | 2026-10-01 | Удалить, когда Tauri заменит unmaintained-семейство `rust-unic` |
| RUSTSEC-2025-0080 | `rust-unic` через Tauri `urlpattern` | Desktop URL-pattern parsing | Release/Security | https://rustsec.org/advisories/RUSTSEC-2025-0080.html | 2026-10-01 | Удалить, когда Tauri заменит unmaintained-семейство `rust-unic` |
| RUSTSEC-2025-0081 | `rust-unic` через Tauri `urlpattern` | Desktop URL-pattern parsing | Release/Security | https://rustsec.org/advisories/RUSTSEC-2025-0081.html | 2026-10-01 | Удалить, когда Tauri заменит unmaintained-семейство `rust-unic` |
| RUSTSEC-2025-0098 | `rust-unic` через Tauri `urlpattern` | Desktop URL-pattern parsing | Release/Security | https://rustsec.org/advisories/RUSTSEC-2025-0098.html | 2026-10-01 | Удалить, когда Tauri заменит unmaintained-семейство `rust-unic` |
| RUSTSEC-2025-0100 | `rust-unic` через Tauri `urlpattern` | Desktop URL-pattern parsing | Release/Security | https://rustsec.org/advisories/RUSTSEC-2025-0100.html | 2026-10-01 | Удалить, когда Tauri заменит unmaintained-семейство `rust-unic` |

## Процедура проверки

1. Запустить `cargo deny check` и `cargo tree -i <crate>` для locked graph.
2. Убедиться, что advisory остаётся только unmaintained или выяснить, стала ли она эксплуатируемой vulnerability.
3. Записать достижимую поверхность Scriptor и прямой parent, мешающий удалению.
4. Немедленно удалить ignore при появлении совместимого поддерживаемого пути.
5. Просроченную дату `Review by` считать блокером production release.
