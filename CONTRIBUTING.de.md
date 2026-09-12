# Beitragen

[English](CONTRIBUTING.md) · [فارسی](CONTRIBUTING.fa.md) · [简体中文](CONTRIBUTING.zh-CN.md) · [Русский](CONTRIBUTING.ru.md) · **Deutsch** · [Español](CONTRIBUTING.es.md)

## Bevor Sie Code ändern

1. Lesen Sie [`PRODUCT.de.md`](PRODUCT.de.md), [`DESIGN.de.md`](DESIGN.de.md), [`docs/ARCHITECTURE.de.md`](docs/ARCHITECTURE.de.md) und [`docs/CAPABILITY-MATURITY.de.md`](docs/CAPABILITY-MATURITY.de.md).
2. Für das Onboarding von Mitwirkenden, die Verzeichnisübersicht und Einstiegspunkte siehe [`docs/ONBOARDING.de.md`](docs/ONBOARDING.de.md).
3. Für TypeScript-Packages lesen Sie [`packages/README.md`](packages/README.md); importieren Sie Packages ausschließlich über deklarierte Entry Points.
4. Bewahren Sie nicht zusammenhängende staged, unstaged und untracked Änderungen unverändert auf.

## Toolchain

Die lokalen Gates verwenden Node.js 22.12 oder neuer (CI ist auf 22.16.0 festgelegt), pnpm 10.33.0, Rust 1.96.0 und PowerShell 7 (`pwsh`). Browserbasierte Barrierefreiheitsprüfungen benötigen außerdem einen ChromeDriver, der zur installierten Chrome-Version passt; setzen Sie `CHROMEWEBDRIVER`, wenn er nicht automatisch gefunden wird.

```powershell
corepack enable
corepack prepare pnpm@10.33.0 --activate
pnpm install --frozen-lockfile
rustup toolchain install 1.96.0 --profile minimal --component rustfmt --component clippy
rustup default 1.96.0
pwsh --version
```

## Entwicklung

```powershell
pnpm web:dev
pnpm desktop:dev
```

## Änderungsprozess

- Reproduzieren Sie Fehler vor der Korrektur mit einem fehlschlagenden Test.
- Halten Sie Mutationen, Refactorings, Abhängigkeitsupdates und Änderungen generierter Dateien überprüfbar. Wenn ein PR die Major- oder Minor-Version einer Abhängigkeit ändert, prüfen Sie im selben Commit die Aufrufstellen gegen die festgelegten Upstream-Release-Notes: Ein umbenanntes Modul oder eine umbenannte Methode (zum Beispiel verschob `fs4` 1.x `fs_std::FileExt::lock_exclusive` nach `FileExt::lock`) kompiliert auf keiner Plattform, und dieser Fehler verdeckt alle nachfolgenden Gates.
- Leiten Sie externe Befehle über `crates/system-bridge/src/process.rs`.
- Validieren Sie Runtime-JSON ausgehend von `unknown`; fügen Sie keine ungeprüften Assertions an Vertrauensgrenzen hinzu.
- Fügen Sie für jeden neuen nativen Befehl eine Autorisierungsklassifizierung hinzu.
- Verwenden Sie begrenzte Queues/Collections/Ausgaben für langlebige oder benutzergesteuerte Daten.
- Aktualisieren Sie zuerst Source-of-Truth-Dateien und regenerieren Sie danach abgeleitete Verträge.
- Aktualisieren Sie Dokumentation und Capability Ledger, wenn sich Reifegrad oder Support ändern.

## Erforderliche Prüfungen

```powershell
pnpm version:check
pnpm lint:actions
pnpm lint:boundaries
pnpm check:i18n
pnpm check:docs
pnpm check:source
pnpm check:frontend-quality
pnpm lint
pnpm build
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
pnpm test:rust
```

`pnpm test:rust` spiegelt das Rust-Gate der CI: `scriptor-desktop` (abgedeckt durch `desktop-check.yml`) sowie die in Inkubation befindlichen Engines (`scriptor-embeddings`, `scriptor-tantivy-indexer`, `scriptor-wasm-runtime`) werden aus dem Produkt-Testlauf ausgeschlossen und anschließend separat über `test:rust:engines` ausgeführt. `scriptor-citation-engine` bleibt im Produkt-Testgraphen, weil sein BibLaTeX-Parser eine unterstützte Abhängigkeit des Indexers ist; lediglich die citeproc-/Rendering-Oberfläche des Crates bleibt in Inkubation.

Führen Sie fokussierte Package-Validatoren und die relevanten Playwright-Suiten für das geänderte Verhalten aus. UI-Änderungen müssen Nachweise für Tastaturbedienung, Screenreader-Semantik, Lade-/Leer-/Fehlerzustände, schmale Viewports und 200 % Zoom enthalten.

`pnpm check:release` ist ein umfassendes Release-Gate, nicht die schnellste lokale Feedbackschleife. Beginnen Sie mit den fokussierten Prüfungen oben und führen Sie anschließend das vollständige Gate auf einem System aus, auf dem die Desktop-/Browser-Voraussetzungen installiert sind.

Begriffe für Nachweise sowie Plattform-/Release-Gates sind in [`docs/VERIFICATION.de.md`](docs/VERIFICATION.de.md) definiert. Beschreiben Sie eine statische Quellcodeprüfung niemals als kompiliertes, paketiertes, natives oder browser-verifiziertes Ergebnis.

## Pull Requests

Beschreiben Sie:

- welches beobachtbare Verhalten geändert wurde;
- welche Autoritäts-/Datengrenzen betroffen sind;
- ausgeführte Tests und Befehle einschließlich Ergebnissen;
- Migrations-/Rollback-Verhalten;
- Screenshots für sichtbare Änderungen;
- nicht verifizierte Plattformen oder verbleibende Risiken.

Committen Sie keine Geheimnisse, generierten Build-Verzeichnisse, Debug-Logs oder persönliche Vault-Daten.

## Lizenzierung

Sofern nicht anders angegeben, stehen Beiträge unter **AGPL-3.0-or-later**. Mit dem Einreichen eines Beitrags bestätigen Sie, dass Sie berechtigt sind, ihn unter diesen Bedingungen zu lizenzieren. Die Richtlinie für eine separate Lizenz finden Sie in [`COMMERCIAL-LICENSING.de.md`](COMMERCIAL-LICENSING.de.md).

## Sicherheit

Melden Sie Sicherheitslücken privat gemäß [`SECURITY.de.md`](SECURITY.de.md).
