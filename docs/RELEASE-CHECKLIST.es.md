# Lista de comprobación para releases de producción

[English](RELEASE-CHECKLIST.md) · [简体中文](RELEASE-CHECKLIST.zh-CN.md) · [Русский](RELEASE-CHECKLIST.ru.md) · [Deutsch](RELEASE-CHECKLIST.de.md) · **Español** · [فارسی](RELEASE-CHECKLIST.fa.md)

Revise los baselines de capturas visuales antes de aprobar un release. La galería canónica está en el [`README.md`](../README.md) principal; el inventario completo de capturas revisadas, notas de reviewer y workflow de regeneración está en [`assets/screenshots/README.md`](assets/screenshots/README.md), y la disciplina de review/cobertura de la suite en [`VISUAL-REVIEW.md`](VISUAL-REVIEW.md).

Un production release queda bloqueado hasta que cada elemento obligatorio se compruebe contra el tag exacto y los bytes exactos del artifact.

## Condiciones de parada de promotion

- [ ] detener si cualquier elemento obligatorio está pending/failed/skipped o probado sobre otro source tree;
- [ ] detener si el installer subject set difiere del receipt por un solo archivo;
- [ ] detener si falta un target, se duplica, aparece inesperadamente o está mal etiquetado;
- [ ] detener si initial editor chunks entran en eager bundle graph o empeora gzip budget;
- [ ] detener si cancelación/fallo de destructive action deja disk/tabs/index/vault divergentes;
- [ ] detener si process launch no tiene live per-call inventory entry o review expiró;
- [ ] detener si rollback/restore/trust status/observability no pueden demostrarse en target platform;
- [ ] detener si una RustSec exception review expiró o carece de owner/exit condition;
- [ ] detener si Playwright E2E o visual regression se omiten/faltan en exact-head CI matrix;
- [ ] detener si protected release environment no existe, no tiene required reviewer o no gatea production publish job;
- [ ] detener si GitHub Pages no tiene environment `github-pages` aprobado por separado cuando el vault publicado requiere review.

## Congelación del source

- [ ] canonical working tree limpio;
- [ ] metadata npm/Cargo/Tauri/lockfile sincronizada y acorde a `VERSION`;
- [ ] tag revisado `v<version>` coincide con `VERSION` y release commit exacto;
- [ ] nunca mover/reutilizar version tag existente;
- [ ] `pnpm check:governance` pasa;
- [ ] `pnpm check:source` pasa;
- [ ] validación no cambia lockfiles;
- [ ] full history/secret/provenance audit reconciliado con el tag;
- [ ] workflow non-publishing `Release Binary Review` pasó para candidate exacto y se retuvo CLI/daemon binary manifest.

## Verificación de ingeniería

- [ ] frozen pnpm install exitoso;
- [ ] lint, TypeScript build, package contract runners, unit/integration tests pasan;
- [ ] Cargo fmt, Clippy, tests, cargo-deny pasan en product/incubating profiles;
- [ ] daemon, CLI/TUI, container, E2E, visual, axe y performance gates pasan;
- [ ] no se acepta silenciosamente ningún skipped/flaky test.

## Seguridad e integridad de datos

- [ ] cada native command nuevo está clasificado e inventariado para authorization;
- [ ] no hay nuevo remote fallback, generic secret API, shell string, unbounded queue/log/output ni unchecked boundary assertion;
- [ ] release workflows no dependen de certificate/notarization/private key/signing secret;
- [ ] release notes oficiales declaran claramente installers unsigned;
- [ ] backup creation, corruption rejection, interrupted/successful restore se ensayaron;
- [ ] MCP interrupted-mutation reconciliation y audit integrity se ensayaron;
- [ ] privacy/diagnostic output está redacted y bounded.

## Calidad UI

- [ ] screenshots regenerados/revisados en todos los breakpoints/themes requeridos;
- [ ] sin console errors ni failed network resources;
- [ ] keyboard/focus order pasa en cada modal, composite tab control y toolbar popover;
- [ ] menus Typography/Insert se renderizan en body portal fuera de scroll-clipping ancestors, quedan en viewport, cierran con Escape/Tab/outside click y restauran focus tras Escape;
- [ ] toolbar popover positioning no provoca render loop adicional de React;
- [ ] axe sin critical/serious violation;
- [ ] screen reader, 200% zoom, reduced motion, high contrast spot checks pasan;
- [ ] empty/loading/error/success/destructive states revisados visualmente.

## Producción de artifacts

- [ ] build una vez desde frozen tag;
- [ ] Windows x86_64: exactamente 1 MSI + 1 NSIS EXE;
- [ ] macOS aarch64: exactamente 1 DMG;
- [ ] Linux x86_64: exactamente 1 DEB + 1 AppImage;
- [ ] Linux aarch64: exactamente 1 DEB + 1 AppImage;
- [ ] cada target escribe `signing-evidence-<platform>-<architecture>.json`;
- [ ] official records: `signed: false`, `notarized: false`, `signatureType: "none"`;
- [ ] artifact names incluyen version/platform/architecture y no colisionan;
- [ ] cada transport artifact contiene solo installers + target-status record;
- [ ] publication separa exactamente 7 installers en `release-artifacts` y 4 trust records en `release-evidence`;
- [ ] sin unpacked AppDir, `.app` internals, DMG helper scripts, logs, caches, source maps ni development files;
- [ ] clean install + smoke test pasan en cada target.

## Provenance y publicación

- [ ] workflow primario `Release` es el único GitHub Release owner;
- [ ] preview dispatch no publica;
- [ ] production dispatch ligado a immutable `v*` tag existente;
- [ ] generar `SHA256SUMS` solo para 7 installer subjects;
- [ ] generar CycloneDX 1.6 SBOM ligado a release source identity;
- [ ] generar release receipt schema 4 con installer hashes + 4 architecture-bound trust records;
- [ ] verificar receipt/checksum/SBOM/source identity/trust metadata/exact installer membership antes del upload;
- [ ] generar GitHub provenance + SBOM attestations para cada installer subject;
- [ ] publicar exact downloaded installers/evidence sin rebuild;
- [ ] verificar instrucciones single-installer de `RELEASE-SECURITY.md` contra published assets;
- [ ] release notes incluyen unknown-publisher guidance + checksum/attestation commands;
- [ ] actualizar changelog, capability ledger, support window, known limitations.
