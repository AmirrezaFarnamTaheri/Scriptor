[English](README.md) · [فارسی](README.fa.md) · [简体中文](README.zh-CN.md) · [Русский](README.ru.md) · **Deutsch** · [Español](README.es.md)

# Scriptor-Screenshots

Screenshots für Dokumentation und Marketing. Erzeugt mit Playwright im E2E-Modus.

## Verfügbare Screenshots

| Screenshot | Beschreibung | Verwendet in |
|---|---|---|
| workspace-light.png | Geprüfte helle Workspace-Aufnahme | README / Docs |
| workspace-dark.png | Geprüfte dunkle Workspace-Aufnahme | Docs + stabile visuelle Abdeckung |
| workspace-tablet.png | Workspace-Breakpoint bei 1024 px | VISUAL-REVIEW |
| workspace-mobile.png | Responsive Workspace-Aufnahme bei 820 px | VISUAL-REVIEW |
| editor-preview.png | Geprüfte Split-Ansicht Editor/Vorschau | Docs + stabile visuelle Abdeckung |
| inspector-preview.png | Inspector-Vorschau mit Editor/Preview-Steuerung | VISUAL-REVIEW |
| command-palette.png | Geprüfte Command-Palette | Docs + stabile visuelle Abdeckung |
| graph.png | Geprüfte Graph-Aufnahme | Docs + stabile visuelle Abdeckung |
| canvas.png | Räumliches Canvas-Board zur visuellen Notizanordnung | VISUAL-REVIEW, STORE-MIGRATION, CAPABILITIES |
| git-panel.png | Versionskontrolle: Status, Commit, Pull/Push | VISUAL-REVIEW, STORE-MIGRATION |
| mcp-panel.png | Geprüftes MCP-Panel | Docs + stabile visuelle Abdeckung |
| settings.png | Runtime-/Vault-Konfiguration, Darstellung, Diagnose | VISUAL-REVIEW, STORE-MIGRATION |
| publish-center.png | Geprüftes Publish Center | Docs + stabile visuelle Abdeckung |
| vault-health.png | Vault-Health-Dashboard mit Lint- und Health-Scores | VISUAL-REVIEW, RELEASE-CHECKLIST |
| knowledge-workbench.png | Knowledge Workbench | VISUAL-REVIEW |
| conflict-resolver.png | 3-Wege-Merge mit Hunk-Auswahl ours/theirs | VISUAL-REVIEW, STORE-MIGRATION |
| note-history.png | Revisionsverlauf mit Wiederherstellung | VISUAL-REVIEW |
| keyboard-shortcuts.png | Editor für Tastaturkürzel | VISUAL-REVIEW |
| onboarding-tour.png | Produkttour beim ersten Start | VISUAL-REVIEW |
| plugins.png | Plugin-Marktplatz, Discovery und Verwaltung | VISUAL-REVIEW, STORE-MIGRATION, CAPABILITIES |
| editor-recovery.png | Recovery-Fallback des Editors | VISUAL-REVIEW, RELEASE-CHECKLIST |
| mcp-sharing-inventory.png | MCP-Sharing- und Ressourceninventar | VISUAL-REVIEW |
| toolbar-typography.png | Typografie-Popover der Toolbar | VISUAL-REVIEW |
| toolbar-insert.png | Insert-Popover der Toolbar | VISUAL-REVIEW |
| mobile-inspector.png | Mobiler Inspector bei 390 px | VISUAL-REVIEW |
| mobile-vault.png | Mobiles Vault-Panel bei 390 px | VISUAL-REVIEW |

### Aktualität und Akzeptanz

Dokumentations-PNGs sind **frische Aufnahmen des aktuellen Quellstands**, keine Kopien gespeicherter Playwright-Vergleichsbaselines. Die Screenshot-Tests schreiben zunächst die stabilisierte Seite direkt nach `docs/assets/screenshots/` und führen danach unabhängig `toHaveScreenshot` gegen die stabilen Windows-Baselines unter `e2e/screenshots.spec.ts-snapshots/` aus.

Diese Trennung ist beabsichtigt. Eine gespeicherte Baseline kann weiterhin akzeptiert werden, wenn der aktuelle Render innerhalb der konfigurierten visuellen Toleranz abweicht. Würde man anschließend die Baseline über das frische Dokumentationsbild kopieren, wären die Docs trotz erfolgreicher Regressionstests veraltet.

Die stabilen Windows-Baselines bleiben die Akzeptanzoberfläche für visuelle Regressionen. Absichtliche Pixeländerungen müssen geprüft und ausdrücklich mit `--update-snapshots=all` aktualisiert werden; visuelle Fehler werden nie durch Erhöhen der globalen Toleranz verborgen.

Responsive und zustandsbezogene Dokumentationsaufnahmen (`workspace-mobile`, `workspace-tablet`, mobile Vault/Inspector, Editor-Recovery, MCP-Sharing-Inventar und Toolbar-Popovers) werden aus aktuellem Testoutput erzeugt und nur dann zu stabilen Pixelbaselines erhoben, wenn der Test ausdrücklich `toHaveScreenshot` verwendet.

## Regenerierung

Screenshots werden mit Playwright im E2E-Modus aufgenommen. Die Mock-IPC-Bridge liefert Fixture-Daten; ein echtes Vault oder Tauri-Binary ist nicht nötig. Vor dem Schreiben der Dokumentationspixel wartet der Capture-Prozess auf Fonts, sichtbare Bilder, Lazy-Panels, endliche Übergänge und einen nicht degradierten Preview-Zustand.

Normale lokale Dokumentationsaufnahme:

```powershell
pnpm screenshots:capture:web
```

Absichtlicher visueller Refresh in der gepinnten Windows-Umgebung:

```powershell
./scripts/screenshots/capture.ps1 -SkipDesktopBuild -UpdateBaselines
```

`-UpdateBaselines` erzeugt alle stabilen Windows-Snapshots mit `--update-snapshots=all` neu, aktualisiert die nur für Docs bestimmten State-Review-Screenshots aus frischem Playwright-Output und behält die von `screenshots.spec.ts` geschriebenen Dokumentationsaufnahmen bei. Gespeicherte Baseline-PNGs werden **nicht** über das Docs-Verzeichnis kopiert.

Zusätzlich gibt es den manuellen Workflow **Refresh documentation screenshots**. Führen Sie ihn auf einem Review-Branch aus, nicht auf `main`. Er verwendet den gepinnten Runner `windows-2025` und Edge, führt Capture-Contract-Tests aus, regeneriert Dokumentations- und stabile Windows-Baselines, prüft die vollständige visuelle Suite ohne Snapshot-Updates und committet nur erzeugte PNG-Änderungen auf den ausgewählten Branch.

### Build im E2E-Modus

```powershell
pnpm exec vite build --mode e2e
```

Vite lädt in diesem Modus `.env.e2e`; exportieren Sie `VITE_E2E_MODE` nicht in die Parent-Shell. E2E-Builds verwenden isolierte Output-Verzeichnisse in den Playwright-Konfigurationen. Die Produktions-Bundle-Prüfung lehnt test-only Fault-Injection-Marker ab, falls eine E2E-Umgebung in Release-Assets gelangt.

### Playwright-Screenshot-Tests ausführen

```powershell
$env:VITE_SCREENSHOT_MODE = 'true'
$env:SCRIPTOR_CAPTURE_SCREENSHOTS = 'true'
pnpm exec playwright test --config playwright.e2e.config.ts e2e/screenshots.spec.ts --workers=1
```

### Browser-Channel überschreiben

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chrome'
```

## Architektur

Die Screenshot-Pipeline verwendet dieselbe E2E-Mock-IPC-Bridge wie die Funktionstests:

- **`playwright.e2e.config.ts`** — Playwright-Konfiguration für E2E-Tests und Dokumentations-Capture
- **`playwright.visual.config.ts`** — stabile visuelle Regression und State-Review-Prüfung
- **`e2e/screenshots.spec.ts`** — stabile Szenarien; schreibt frische Docs-Captures und validiert Baselines
- **`e2e/visual-review.spec.ts`** — responsive und zustandsbezogene Evidenz
- **`scripts/screenshots/capture.ps1`** — deterministischer Capture-/Orchestrierungsvertrag
- **`scripts/validation/screenshot-capture-contracts.test.mjs`** — Regression-Guard gegen Überschreiben frischer Bilder durch alte Baselines
- **`src/e2e/bootstrap.ts`** — Mock-IPC-Bridge mit Vault-, Git-, Indexer- und Export-Fixtures
- **`src/e2e/state.ts`** — In-Memory-Notizzustand des Mock-Vaults
- **`src/screenshot/fixture.ts`** — Fixture-Daten für Vault, Scan, Graph und Health-Diagnose

Nach UI-Änderungen, die Layout oder Copy beeinflussen, PNGs neu erzeugen und prüfen. Browser/Channel, OS, Source-Commit, Viewport und Ergebnis im Release-PR festhalten. Siehe [`../../validation/FRONTEND_QUALITY.de.md`](../../validation/FRONTEND_QUALITY.de.md).
