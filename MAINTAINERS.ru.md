# Сопровождающие проекта

[English](MAINTAINERS.md) · [فارسی](MAINTAINERS.fa.md) · [简体中文](MAINTAINERS.zh-CN.md) · **Русский** · [Deutsch](MAINTAINERS.de.md) · [Español](MAINTAINERS.es.md)

## Текущий сопровождающий

Amirreza “Farnam” Taheri  
Эл. почта: [taherifarnam@gmail.com](mailto:taherifarnam@gmail.com)  
GitHub: [@AmirrezaFarnamTaheri](https://github.com/AmirrezaFarnamTaheri)

## Модель владения

Загруженная исходная база не содержит канонической истории Git, поэтому историческое владение и bus factor нельзя доказать только по этому артефакту. В репозитории теперь есть [`.github/CODEOWNERS`](.github/CODEOWNERS), однако применение правил на хостинге и фактическую концентрацию ревью необходимо проверять в каноническом репозитории. Следует поддерживать:

- `CODEOWNERS` для путей безопасности, релизов, ядра Rust, фронтенда и документации;
- как минимум двух ревьюеров для релизных и чувствительных к безопасности изменений;
- ежеквартальный отчёт о владельцах, churn и истории секретов;
- неизменяемые релизные теги и защищённые production-окружения.

Пока дополнительные сопровождающие не зарегистрированы, ведущий сопровождающий является владельцем эскалации для всех областей. Это риск непрерывности, а не предполагаемая структура команды.

Создайте локальные доказательства истории из полного клона командой:

```bash
bash scripts/governance/history-audit.sh . .history-audit
```

## Полномочия на выпуск

Production-релизы:

1. создаются из тега `v<version>`, совпадающего с [`VERSION`](VERSION);
2. проходят `.github/workflows/ci.yml` и платформенные compile/package-gates;
3. используют документированную модель доверия для неподписанных установщиков: точную идентичность исходного кода, SHA-256 checksums, привязанные к target записи trust-status, SBOM, release receipt и attestations происхождения GitHub;
4. продвигают в точности загруженные build-артефакты без повторной сборки на этапе публикации;
5. публикуют checksums, SBOM, release receipt, trust-метаданные и attestations, требуемые контрактом release evidence.

См. [`docs/RELEASE-SECURITY.ru.md`](docs/RELEASE-SECURITY.ru.md).

## Поддержка и эскалация

| Тема | Канал |
|---|---|
| Безопасность | Приватное письмо согласно [`SECURITY.ru.md`](SECURITY.ru.md) |
| Ошибки/функции | GitHub Issues |
| Вклад | [`CONTRIBUTING.ru.md`](CONTRIBUTING.ru.md) |
| Лицензирование | [`COMMERCIAL-LICENSING.ru.md`](COMMERCIAL-LICENSING.ru.md) |
| Статус возможностей | [`docs/CAPABILITY-MATURITY.ru.md`](docs/CAPABILITY-MATURITY.ru.md) |
