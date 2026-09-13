[English](MOBILE_ARCHITECTURE.md) · [فارسی](MOBILE_ARCHITECTURE.fa.md) · [简体中文](MOBILE_ARCHITECTURE.zh-CN.md) · **Русский** · [Deutsch](MOBILE_ARCHITECTURE.de.md) · [Español](MOBILE_ARCHITECTURE.es.md)

# Мобильная архитектура

**Зрелость:** только дизайн / инкубация.  
**Статус поставки:** не входит в поддерживаемый desktop-продукт Scriptor 1.0.  
**Авторитет:** [`PRODUCT.ru.md`](../../PRODUCT.ru.md) и [`CAPABILITY-MATURITY.ru.md`](../CAPABILITY-MATURITY.ru.md).

## Назначение

Документ фиксирует архитектурную границу будущей мобильной работы, не создавая впечатления, что Android- или iOS-приложение уже выпущено. Поддерживаемым продуктом остаётся Tauri desktop для Windows, macOS и Linux. Мобильные прототипы могут исследовать переносимую доменную логику и user flows, но не должны незаметно расширять контракт поддержки.

## Архитектурный контракт

Будущий мобильный клиент должен сохранять те же инварианты:

1. **Markdown авторитетен.** Заметки остаются обычными файлами; мобильный индекс производный и пересоздаваемый.
2. **Переносимая доменная логика находится ниже платформенных адаптеров.** Parsing, task semantics, link resolution, templates, merge logic и другие детерминированные политики относятся в общие packages/crates при нейтральных API.
3. **Нативные возможности — явные адаптеры.** File picker, background work, notifications, secure storage, share sheets и platform lifecycle скрываются за мобильными границами.
4. **Нет скрытой облачной зависимости.** Будущий sync опционален и моделируется отдельно; mobile по умолчанию не меняет local-first модель.
5. **Границы доверия fail-closed.** External intents, imported files, plugin/tool execution и будущая remote sync требуют явной проверки и ограниченных ресурсов.
6. **Поведенческий паритет доказывается контрактами, а не копированием UI.** Общие fixtures и generated contracts подтверждают семантику note/task/link на desktop и mobile.

## Предлагаемая топология

```text
mobile UI / navigation
        |
        v
mobile application adapter
        |
        +--> shared TypeScript domain packages
        |
        +--> native mobile capability adapters
                 |-- filesystem / document provider
                 |-- secure settings / credentials
                 |-- notifications / background scheduling
                 `-- optional sync transport (future, separately governed)
```

Материалы `apps/mobile/`, если присутствуют, являются исследовательскими. Desktop release gates не должны воспринимать их как production target, а packaging comments не должны называть Android/iOS поддерживаемыми release platforms.

## Условия повышения зрелости

Переход **Design-only** → **Experimental** возможен только при наличии:

- названных runtime/toolchain и воспроизводимой точки build;
- модели авторитета данных, сохраняющей переносимость Markdown;
- threat models для permissions, background execution и secure storage;
- contract tests общей семантики note/task/link;
- migration/backup/recovery пользовательских файлов;
- accessibility/lifecycle tests минимум на одном реальном классе устройств;
- явной support matrix в `PRODUCT.md` и `CAPABILITY-MATURITY.md`.

Для **Production** дополнительно нужны release packaging, signing/trust policy, crash/diagnostics support, upgrade/rollback и те же стандарты release evidence, что для desktop.

## Не-цели текущего релиза

- нет заявления о feature parity Android/iOS;
- нет мобильного installer/package в desktop release;
- нет mobile-specific compatibility burden на desktop internals;
- нет обязательной cloud account только ради будущей мобильной работы.
