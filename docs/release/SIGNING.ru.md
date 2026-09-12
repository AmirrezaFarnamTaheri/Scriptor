# Статус доверия к релизу и downstream-подпись

[English](SIGNING.md) · [简体中文](SIGNING.zh-CN.md) · **Русский** · [Deutsch](SIGNING.de.md) · [Español](SIGNING.es.md) · [فارسی](SIGNING.fa.md)

Scriptor разделяет целостность публикации upstream-релиза и подписи издателя, проверяемые операционной системой.

## Политика upstream-релизов

Официальные GitHub Releases намеренно выпускаются **без цифровой подписи издателя**:

- сертификат Windows не требуется;
- Apple Developer ID и учётные данные для notarization не требуются;
- закрытый ключ Linux OpenPGP не требуется;
- release workflow не читает секреты подписи;
- preview- и production-релизы используют одну и ту же явную политику unsigned;
- production-публикация по-прежнему требует полного набора checksum, SBOM, release receipt, доказательства идентичности исходников, exact-subject и GitHub attestations.

Так устраняется прежнее противоречие, когда создание релиза формально поддерживалось, но каждый production job останавливался до компиляции при отсутствии signing secrets в репозитории.

## Доказательства статуса целей

Каждая сборка записывает `signing-evidence-<platform>-<architecture>.json` по schema 2. Запись содержит:

- платформу и архитектуру;
- канал preview или production;
- значения `signed`, `notarized` и `signatureType`;
- инструкции для проверяющего;
- точный commit исходников;
- метку времени создания.

Официальный workflow записывает `signed: false`, `notarized: false` и `signatureType: "none"`. Верификатор публикации требует полный набор целей:

- Windows `x86_64`;
- macOS `aarch64`;
- Linux `x86_64`;
- Linux `aarch64`.

Верификатор отклоняет дубликаты, отсутствующие и неожиданные цели, неверный канал и несовпадение source commit. При публикации четыре записи переносятся в `release-evidence`; receipt schema 4 включает те же нормализованные записи и побайтово проверяет совпадение с метаданными. Записи доверия не являются объектами checksum установщиков или attestations.

## Поведение операционных систем

Поскольку upstream-установщики не подписаны:

- Windows SmartScreen может показать неизвестного издателя;
- macOS Gatekeeper может потребовать разрешить открытие приложения через System Settings или контекстное меню Finder;
- Linux-пакеты опираются на скачанный checksum и GitHub attestation, а не на upstream-подпись пакета OpenPGP.

Эти ограничения должны быть заметно указаны в release notes. Приложение не должно утверждать наличие Authenticode-подписи, Apple notarization или OpenPGP-подписи, если их нет.

## Подпись downstream-дистрибьютором

Downstream-дистрибьютор может подписать копию установщика собственным сертификатом или средствами своего репозитория пакетов. Получатся другие байты, а значит — другой checksum и другой attestation subject по сравнению с upstream GitHub Release.

Downstream-дистрибьютор обязан:

1. сначала проверить upstream checksum и GitHub attestation;
2. сохранить upstream receipt и source commit;
3. подписывать только в собственной контролируемой среде распространения;
4. публиковать новые checksums и инструкции проверки подписи от собственного имени;
5. никогда не заменять upstream-артефакты в официальном релизе Scriptor.

Схема evidence позволяет независимым инструментам представить корректно подписанный artifact, однако официальный upstream CI не импортирует и не использует закрытые материалы подписи.

## Локальная проверка

Проверка политики без секретов и матрицы целей:

```bash
node scripts/release/validate-signing-policy.mjs \
  --platform linux \
  --architecture x86_64 \
  --channel production
node --test scripts/release/signing-policy.test.mjs
```

Создание локальной записи unsigned-статуса:

```bash
node scripts/release/write-signing-evidence.mjs \
  --platform linux \
  --architecture x86_64 \
  --channel production \
  --signed false \
  --notarized false \
  --signature-type none \
  --verifier "unsigned artifact; verify SHA-256 and GitHub attestation"
```

Даже без обязательной подписи издателя release verifier остаётся fail-closed для целостности и полноты.
