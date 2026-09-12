# Checkliste für Production Releases

[English](RELEASE-CHECKLIST.md) · [简体中文](RELEASE-CHECKLIST.zh-CN.md) · [Русский](RELEASE-CHECKLIST.ru.md) · **Deutsch** · [Español](RELEASE-CHECKLIST.es.md) · [فارسی](RELEASE-CHECKLIST.fa.md)

Vor Freigabe eines Releases sind die Baselines der visuellen Captures zu prüfen. Die kanonische Screenshot-Galerie steht im Haupt-[`README.md`](../README.md), das vollständige Inventar aller geprüften Captures samt Reviewer-Notizen und Regenerationsworkflow in [`assets/screenshots/README.md`](assets/screenshots/README.md), Review-Disziplin und Suite-Abdeckung in [`VISUAL-REVIEW.md`](VISUAL-REVIEW.md).

Ein Production Release bleibt blockiert, bis jeder Pflichtpunkt gegen das exakte Tag und die exakten Artefaktbytes geprüft wurde.

## Stop-Bedingungen für Promotion

- [ ] stoppen, wenn ein Pflichtpunkt pending/failed/skipped ist oder auf einem anderen Source Tree belegt wurde;
- [ ] stoppen, wenn Installer Subject Set und Receipt auch nur um eine Datei abweichen;
- [ ] stoppen bei fehlendem, doppeltem, unerwartetem oder falsch beschriftetem Target;
- [ ] stoppen, wenn initial Editor Chunks in den eager Bundle Graph gelangen oder das gzip Budget regressiert;
- [ ] stoppen, wenn Cancellation/Failure einer destruktiven Aktion Disk/Tabs/Index/Vault divergieren lässt;
- [ ] stoppen, wenn ein Process Launch keinen live per-call Inventory Entry hat oder dessen Review abgelaufen ist;
- [ ] stoppen, wenn Rollback, Restore, Trust Status oder Observability auf der Zielplattform nicht demonstriert werden können;
- [ ] stoppen, wenn eine RustSec Exception Review abgelaufen ist oder Owner/Exit Condition fehlt;
- [ ] stoppen, wenn Playwright E2E oder Visual Regression in der exact-head CI Matrix übersprungen/fehlend ist;
- [ ] stoppen, wenn Protected Release Environment fehlt, keinen Required Reviewer hat oder den Production Publish Job nicht gate-t;
- [ ] stoppen, wenn GitHub Pages bei review-pflichtigem Vault Content kein separat genehmigtes `github-pages` Environment nutzt.

## Source Freeze

- [ ] sauberer kanonischer Working Tree;
- [ ] synchronisierte npm-/Cargo-/Tauri-/Lockfile-Metadaten entsprechen `VERSION`;
- [ ] reviewed `v<version>` Tag entspricht `VERSION` und exaktem Release Commit;
- [ ] existierendes Version Tag nie verschieben/wiederverwenden;
- [ ] `pnpm check:governance` besteht;
- [ ] `pnpm check:source` besteht;
- [ ] Lockfiles bleiben durch Validierung unverändert;
- [ ] vollständiger History/Secret/Provenance Audit ist mit Tag abgeglichen;
- [ ] non-publishing `Release Binary Review` besteht für exakten Candidate und CLI/Daemon Binary Manifest wurde behalten.

## Engineering-Verifikation

- [ ] frozen pnpm install erfolgreich;
- [ ] lint, TypeScript build, package contract runners, unit/integration tests bestehen;
- [ ] Cargo fmt, Clippy, Tests, cargo-deny bestehen auf Product/Incubating Profiles;
- [ ] daemon, CLI/TUI, container, E2E, visual, axe und performance gates bestehen;
- [ ] kein skipped/flaky Test wird still akzeptiert.

## Sicherheit und Datenintegrität

- [ ] jeder neue Native Command ist klassifiziert und im Authorization Inventory;
- [ ] kein neuer Remote Fallback, Generic Secret API, Shell String, unbounded Queue/Log/Output oder unchecked Boundary Assertion;
- [ ] Release Workflows haben keine Certificate-/Notarization-/Private-Key-/Signing-Secret-Abhängigkeit;
- [ ] offizielle Release Notes nennen unsigned Installer deutlich;
- [ ] Backup Creation, Corruption Rejection, Interrupted Restore, Successful Restore wurden geübt;
- [ ] MCP Interrupted-Mutation Reconciliation und Audit Integrity wurden geübt;
- [ ] Privacy/Diagnostic Output ist redacted und bounded.

## UI-Qualität

- [ ] Screenshots für alle Pflicht-Breakpoints/-Themes neu erzeugt und geprüft;
- [ ] keine Console Errors oder Failed Network Resources;
- [ ] Keyboard/Focus Order besteht inkl. Modals, Composite Tabs und Toolbar Popovers;
- [ ] Typography/Insert Menus werden per Body Portal außerhalb Scroll-Clipping Ancestors gerendert, bleiben im Viewport, schließen via Escape/Tab/Outside Click und stellen Focus nach Escape wieder her;
- [ ] Toolbar-Popover-Positioning erzeugt keinen zusätzlichen React Render Loop;
- [ ] axe ohne critical/serious violations;
- [ ] Screen Reader, 200% Zoom, Reduced Motion, High Contrast Spot Checks bestehen;
- [ ] Empty/Loading/Error/Success/Destructive States visuell geprüft.

## Artefaktproduktion

- [ ] einmal aus Frozen Tag bauen;
- [ ] Windows x86_64: exakt ein MSI + ein NSIS EXE;
- [ ] macOS aarch64: exakt ein DMG;
- [ ] Linux x86_64: exakt ein DEB + ein AppImage;
- [ ] Linux aarch64: exakt ein DEB + ein AppImage;
- [ ] jedes Target schreibt `signing-evidence-<platform>-<architecture>.json`;
- [ ] offizielle Records: `signed: false`, `notarized: false`, `signatureType: "none"`;
- [ ] Artifact Names enthalten Version/Platform/Architecture und kollidieren nicht;
- [ ] jedes Transport Artifact enthält nur Installer + Target-Status Record;
- [ ] Publication trennt exakt 7 Installer nach `release-artifacts` und 4 Trust Records nach `release-evidence`;
- [ ] keine unpacked AppDir-Inhalte, `.app`-Interna, DMG Helper Scripts, Logs, Caches, Source Maps, Development Files;
- [ ] Clean Install + Smoke Test auf jedem Target.

## Provenance und Publication

- [ ] primärer `Release` Workflow ist einziger GitHub Release Owner;
- [ ] Preview Dispatch veröffentlicht nicht;
- [ ] Production Dispatch ist an existierendes immutable `v*` Tag gebunden;
- [ ] `SHA256SUMS` nur für 7 Installer Subjects erzeugen;
- [ ] CycloneDX 1.6 SBOM an Release Source Identity binden;
- [ ] Release Receipt Schema 4 mit Installer Hashes + 4 architecture-bound Trust Records erzeugen;
- [ ] Receipt, Checksum, SBOM, Source Identity, Trust Metadata, Exact Installer Membership vor Upload prüfen;
- [ ] GitHub Provenance- und SBOM-Attestations für jedes Installer Subject erzeugen;
- [ ] exakt heruntergeladene Installer/Evidence ohne Rebuild veröffentlichen;
- [ ] Single-Installer Consumer Instructions in `RELEASE-SECURITY.md` gegen Published Assets verifizieren;
- [ ] Release Notes enthalten Unknown-Publisher Guidance und Checksum/Attestation Commands;
- [ ] Changelog, Capability Ledger, Support Window und Known Limitations aktualisieren.
