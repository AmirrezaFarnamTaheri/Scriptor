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
| mcp-panel.png | MCP-Autorisierung und geführte Rezepte | README / docs |
| mcp-tools.png | Read-only Outline im Tools-Tab | README / docs |
| mcp-audit.png | Audit nach Read-only Outline | README / docs |
| settings-appearance.png | Appearance: Palette, Tag/Nacht, Schrift und Dichte | README / docs |
| plugin-permissions.png | Vault Lint: notwendiger Lesezugriff vor Aktivierung | README / docs |
| plugins-installed.png | Vault Lint aktiviert mit Vault-bezogenem Widerruf | README / docs |
| empty-note.png | Leere Notiz ohne aktives Dokument | README / docs |
| settings.png | Runtime-/Vault-Konfiguration, Darstellung, Diagnose | VISUAL-REVIEW, STORE-MIGRATION |
| publish-center.png | Geprüftes Publish Center | Docs + stabile visuelle Abdeckung |
| vault-health.png | Vault-Health-Dashboard mit Lint- und Health-Scores | VISUAL-REVIEW, RELEASE-CHECKLIST |
| knowledge-workbench.png | Knowledge Workbench | VISUAL-REVIEW |
| conflict-resolver.png | 3-Wege-Merge mit Hunk-Auswahl ours/theirs | VISUAL-REVIEW, STORE-MIGRATION |
| note-history.png | Revisionsverlauf mit Wiederherstellung | VISUAL-REVIEW |
| keyboard-shortcuts.png | Editor für Tastaturkürzel | VISUAL-REVIEW |
| onboarding-tour.png | Produkttour beim ersten Start | VISUAL-REVIEW |
| plugins.png | Verwaltung installierter eigener Plugins vor Permission-Review | README / docs |
| editor-recovery.png | Recovery-Fallback des Editors | VISUAL-REVIEW, RELEASE-CHECKLIST |
| mcp-sharing-inventory.png | MCP-Sharing- und Ressourceninventar | VISUAL-REVIEW |
| toolbar-typography.png | Typografie-Popover der Toolbar | VISUAL-REVIEW |
| toolbar-insert.png | Insert-Popover der Toolbar | VISUAL-REVIEW |
| mobile-inspector.png | Mobiler Inspector bei 390 px | VISUAL-REVIEW |
| mobile-vault.png | Mobiles Vault-Panel bei 390 px | VISUAL-REVIEW |
| workspace-rendered.png | Vollständig gerenderte Vorschau mit Markdown-Überschriften | VISUAL-REVIEW |
| task-list-preview.png | Gerenderte Aufgabenlistenelemente mit interaktiven Kontrollkästchen | VISUAL-REVIEW |
| workspace-selector.png | Fokussierter Workspace-Selektor und Identität des aktiven Vaults in der oberen Leiste | VISUAL-REVIEW |

### Zustandsabdeckung und Evidenzgrenzen

**Workflow state screenshots** führt ausgewählte funktionale Zustands-/Recovery-Suites unabhängig aus und erhält Reports für den exakten Commit; die vollständige funktionale Suite bleibt separat erforderlich. `e2e/visual-state-evidence.ts` erzeugt nach Inhalts- und Layoutprüfung Viewport- und Detailbilder. Sie sind Zustandsnachweise, getrennt von stabilen Baselines und veröffentlichten Galeriebildern.

| Suite | Zustände |
|---|---|
| `google-ecosystem-workflows.spec.ts` | Drive-Auswahl, Abbruch, gespeicherte Bindung und Speicherfehler; Docs-Vorschau, Konflikt, Verlustzustimmung und Erstellung; Calendar-Auswahl, Review, Import; persisches RTL/Zoom |
| `google-gmail-workflows.spec.ts` | Inbox, deduplizierte Seiten, wörtlicher Nachrichtentext, Import, Suche, Pagination, Providerfehler, Trennung, erhaltene Compose-Entwürfe, Dark/RTL/Zoom |
| `source-files.spec.ts` | Quellformate, LaTeX-Diagnosen, Konflikt/Verwerfen, Dark Mode |
| `overleaf-workflows.spec.ts` | Verschachtelte Quellen und Stale-Rejection |
| `runtime-kernel.spec.ts` | Session, stdout, Variablen, dekodierter Plot und Lifecycle-Fehler |
| `asset-media.spec.ts` | Dekodiertes Bild, Audio-Controls und Ablehnung |
| `workspace-shortcuts.spec.ts` | Anpassung, Overflow-Menü, Speicherfehler und Zoom |
| `workspace-leaves.spec.ts` | Gruppen, verschobene Panels und inaktive wiederhergestellte Blätter |
| `semantic-visual-states.spec.ts` | 2D/3D-Projektion, Rotation, Ähnlichkeit, leere Schwelle, Fehler mit erhaltenen Messungen |

Bild-/Plot-Fixtures sind deterministische 320×200-PNGs mit geprüften dekodierten Abmessungen. Sie belegen Layout, keine Kameraquelle oder Python-Plot. Google-Fixtures greifen nie auf Live-Konten zu. Aufnahmen sind Ausführungsnachweise erst nach erfolgreicher hosted Suite auf dem dokumentierten Commit und Bildreview. Weitere docs-only Zustände prüfen Plugin-Zustimmung, Enable/Revoke, MCP Outline/Audit, Appearance, Canvas, dichten Graph, Triage, Hilfe, native Vault-Auswahl, RTL, kompakte deutsche Labels, UI-Zoom, Device Scale, Loading, großen Vault und dunkle Dialoge. Diese belegen keine externe MCP-Verbindung, native Zustimmung oder Drittanbieterinstallation. Das native `<select>` wird semantisch geprüft; sein OS-Popup wird nicht als zuverlässiges Screenshot-Ziel behauptet.

### Aktualität und Akzeptanz

Dokumentations-PNGs sind **frische Aufnahmen des aktuellen Quellstands**, keine Kopien gespeicherter Playwright-Vergleichsbaselines. Die Screenshot-Tests schreiben zunächst die stabilisierte Seite direkt nach `docs/assets/screenshots/` und führen danach unabhängig `toHaveScreenshot` gegen die stabilen Windows-Baselines unter `e2e/screenshots.spec.ts-snapshots/` aus.

Diese Trennung ist beabsichtigt. Eine gespeicherte Baseline kann weiterhin akzeptiert werden, wenn der aktuelle Render innerhalb der konfigurierten visuellen Toleranz abweicht. Würde man anschließend die Baseline über das frische Dokumentationsbild kopieren, wären die Docs trotz erfolgreicher Regressionstests veraltet.

Die stabilen Windows-Baselines bleiben die Akzeptanzoberfläche für visuelle Regressionen. Absichtliche Pixeländerungen müssen geprüft und ausdrücklich mit `--update-snapshots=all` aktualisiert werden; visuelle Fehler werden nie durch Erhöhen der globalen Toleranz verborgen.

**Visual review** vergleicht auf dem gepinnten Windows-Runner genau einmal mit `--update-snapshots=none`; PRs schreiben keine Baselines neu. Fehlschläge erhalten bereits Actual/Diff, Traces, Videos und frische Docs-Aufnahmen. Baseline-Änderungen entstehen nur im ausdrücklichen Refresh. `visual-review.zip` speichert einzigartige aktuelle Bilder unter `images/`; `image-manifest.json` enthält SHA-256, Größe und alle Herkunftspfade. Exakte Duplikate werden einmal gespeichert, parallele rohe Baseline-/Resultbäume nicht hochgeladen.

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

Nach erfolgreicher Veröffentlichung dispatcht `release.yml` **Refresh documentation screenshots** auf `main`. Es erfasst aktuellen Main-Code, nicht Release-Tag-Pixel; der separate Workflow muss selbst erfolgreich enden. Manuell kann ein Review-Branch gewählt werden. Der gepinnte Windows-/Edge-Lauf prüft Verträge, aktualisiert Docs/Baselines, verifiziert ohne Updates und committet nur erzeugte PNGs. Das manifestbasierte Paket dedupliziert SHA-256. Push ist nicht erzwungen; bei fortgeschrittenem Branch scheitert er sicher und erfordert einen neuen Lauf.

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
