# Чек-лист production-релиза

[English](RELEASE-CHECKLIST.md) · [简体中文](RELEASE-CHECKLIST.zh-CN.md) · **Русский** · [Deutsch](RELEASE-CHECKLIST.de.md) · [Español](RELEASE-CHECKLIST.es.md) · [فارسی](RELEASE-CHECKLIST.fa.md)

До одобрения релиза проверьте baseline визуальных снимков. Каноническая галерея находится в основном [`README.md`](../README.md), полный индекс reviewed captures, заметки reviewer и workflow регенерации — в [`assets/screenshots/README.md`](assets/screenshots/README.md), дисциплина review и покрытие suite — в [`VISUAL-REVIEW.md`](VISUAL-REVIEW.md).

Production release заблокирован, пока каждый обязательный пункт не проверен против точного tag и байтов artifact.

## Условия немедленной остановки promotion

- [ ] остановить, если любой обязательный пункт pending/failed/skipped или доказан на другом source tree;
- [ ] остановить, если installer subject set отличается от receipt хотя бы одним файлом;
- [ ] остановить при missing/duplicate/unexpected/mislabeled target;
- [ ] остановить, если initial editor chunks попали в eager bundle graph или ухудшился gzip budget;
- [ ] остановить, если cancel/failure destructive action оставляет disk/tabs/index/vault в расходящемся состоянии;
- [ ] остановить, если process launch не имеет live per-call inventory entry или review истёк;
- [ ] остановить, если rollback/restore/trust status/observability нельзя продемонстрировать на target platform;
- [ ] остановить, если RustSec exception review истёк или не имеет owner/exit condition;
- [ ] остановить, если Playwright E2E/visual regression пропущены или отсутствуют в exact-head CI matrix;
- [ ] остановить, если protected release environment отсутствует, не имеет required reviewer или не gate-ит production publish job;
- [ ] остановить, если GitHub Pages deployment не имеет отдельно одобренного `github-pages` environment, когда опубликованный vault content требует review.

## Заморозка source

- [ ] clean canonical working tree;
- [ ] синхронизированные npm/Cargo/Tauri/lockfile metadata соответствуют `VERSION`;
- [ ] reviewed `v<version>` tag соответствует `VERSION` и точному release commit;
- [ ] существующий version tag никогда не перемещается и не переиспользуется;
- [ ] `pnpm check:governance` проходит;
- [ ] `pnpm check:source` проходит;
- [ ] validation не меняет lockfiles;
- [ ] full history/secret/provenance audit согласован с tag;
- [ ] non-publishing `Release Binary Review` прошёл для точного candidate, CLI/daemon binary manifest сохранён.

## Engineering verification

- [ ] frozen pnpm install успешен;
- [ ] lint, TypeScript build, package contract runners, unit/integration tests проходят;
- [ ] Cargo fmt, Clippy, tests, cargo-deny проходят на product/incubating profiles;
- [ ] daemon, CLI/TUI, container, E2E, visual, axe, performance gates проходят;
- [ ] skipped/flaky test не принимается молча.

## Security и целостность данных

- [ ] каждый новый native command классифицирован и внесён в authorization inventory;
- [ ] нет новых remote fallback, generic secret API, shell string, unbounded queue/log/output или unchecked boundary assertion;
- [ ] release workflows не зависят от certificate/notarization/private-key/signing-secret;
- [ ] official release notes явно сообщают, что installers unsigned;
- [ ] backup creation, corruption rejection, interrupted/successful restore отработаны;
- [ ] MCP interrupted-mutation reconciliation и audit integrity отработаны;
- [ ] privacy/diagnostic output redacted и bounded.

## Качество UI

- [ ] screenshots регенерированы и review-нуты для всех нужных breakpoints/themes;
- [ ] нет console errors/failed network resources;
- [ ] keyboard/focus order проходит для modal, composite tab control, toolbar popover;
- [ ] Typography/Insert menus через body portal находятся вне scroll-clipping ancestors, остаются в viewport, закрываются Escape/Tab/outside click и восстанавливают focus после Escape;
- [ ] toolbar popover positioning не вызывает дополнительный React render loop;
- [ ] axe не имеет critical/serious violation;
- [ ] screen reader, 200% zoom, reduced motion, high contrast spot checks проходят;
- [ ] empty/loading/error/success/destructive states review-нуты визуально.

## Производство artifact

- [ ] build один раз из frozen tag;
- [ ] Windows x86_64: ровно MSI + NSIS EXE;
- [ ] macOS aarch64: ровно DMG;
- [ ] Linux x86_64: ровно DEB + AppImage;
- [ ] Linux aarch64: ровно DEB + AppImage;
- [ ] каждый target пишет `signing-evidence-<platform>-<architecture>.json`;
- [ ] official records: `signed: false`, `notarized: false`, `signatureType: "none"`;
- [ ] artifact names включают version/platform/architecture и не сталкиваются;
- [ ] каждый transport artifact содержит только installers + target-status record;
- [ ] publication разделяет ровно 7 installers в `release-artifacts` и 4 trust records в `release-evidence`;
- [ ] отсутствуют unpacked AppDir, `.app` internals, DMG helper scripts, logs, caches, source maps, development files;
- [ ] clean install и smoke test проходят на каждом target.

## Provenance и publication

- [ ] primary `Release` workflow — единственный GitHub Release owner;
- [ ] preview dispatch не публикует;
- [ ] production dispatch привязан к существующему immutable `v*` tag;
- [ ] `SHA256SUMS` создаётся только по 7 installer subjects;
- [ ] CycloneDX 1.6 SBOM связан с release source identity;
- [ ] release receipt schema 4 содержит installer hashes + 4 architecture-bound trust records;
- [ ] receipt/checksum/SBOM/source identity/trust metadata/exact installer membership проверены до upload;
- [ ] GitHub provenance и SBOM attestations создаются для каждого installer subject;
- [ ] публикуются exact downloaded installers/evidence без rebuild;
- [ ] single-installer consumer instructions в `RELEASE-SECURITY.md` проверены против published assets;
- [ ] release notes включают unknown-publisher guidance и checksum/attestation commands;
- [ ] changelog, capability ledger, support window, known limitations обновлены.
