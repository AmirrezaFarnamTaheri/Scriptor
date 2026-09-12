# Pandoc-Strategie

[English](PANDOC_STRATEGY.md) · [简体中文](PANDOC_STRATEGY.zh-CN.md) · [Русский](PANDOC_STRATEGY.ru.md) · **Deutsch** · [Español](PANDOC_STRATEGY.es.md) · [فارسی](PANDOC_STRATEGY.fa.md)

Scriptor exportiert über Pandoc mit expliziten, zugelassenen Argumenten. Desktop-App und CLI verwenden dieselbe Erkennungslogik aus `scriptor-export-runner`.

## Auflösungsreihenfolge

1. **`SCRIPTOR_PANDOC_PATH`** — absoluter Pfad zu einer Pandoc-Executable. Sinnvoll, wenn die IT Pandoc außerhalb von `PATH` installiert oder mehrere Versionen vorhanden sind.
2. **`pandoc` in `PATH`** — Standard. Unter Windows wird der Pfad mit `where pandoc`, unter Unix mit `which pandoc` ermittelt.

Erkennung prüfen:

```powershell
pnpm cli -- export-discover
```

## Installationsoptionen

| Ansatz | Status | Hinweise |
|---|---|---|
| System-Pandoc in `PATH` | **Standard** | Entspricht typischen Power-User-Setups; kleinster Installer. |
| Überschreibung über `SCRIPTOR_PANDOC_PATH` | **Unterstützt** | Für Unternehmensbereitstellungen dokumentiert. |
| Pandoc im Installer gebündelt | **Optional** | `SCRIPTOR_BUNDLED_PANDOC_DIR` + `scripts/release/install-bundled-pandoc.ps1` |

Ein Export-Dry-Run funktioniert ohne installiertes Pandoc und zeigt nur die Argumente. Echte Exporte benötigen ein funktionierendes Pandoc-Binary sowie formatspezifische Engines, zum Beispiel LaTeX für PDF.

## Empfohlene Einrichtung

**Windows (winget):**

```powershell
winget install --id JohnMacFarlane.Pandoc
```

**macOS (Homebrew):**

```bash
brew install pandoc
```

**Linux:** Paket der Distribution oder offizielles Pandoc-Release-Archiv.

## Fehlerszenarien

| Symptom | Lösung |
|---|---|
| `pandoc was not found on PATH` | Pandoc installieren oder `SCRIPTOR_PANDOC_PATH` setzen. |
| Dry-Run erfolgreich, Laufzeitexport schlägt fehl | Für das gewählte Format fehlen Pandoc-Filter/-Engines. |
| Falsche Pandoc-Version wird gewählt | `SCRIPTOR_PANDOC_PATH` auf das gewünschte Binary setzen. |

## Lizenzgrenze zwischen Pandoc GPL und AGPL

Pandoc steht unter **GPL-2.0-or-later**, Scriptor unter **AGPL-3.0-or-later**. Beide Lizenzen sind für die Distribution kompatibel; dennoch ist die Aufrufgrenze relevant.

### Wie Scriptor Pandoc verwendet

Scriptor startet Pandoc über `std::process::Command` in `crates/export-runner` als **externen Prozess**. Pandoc-Quellcode wird weder statisch noch dynamisch in das Scriptor-Binary gelinkt. GPL-lizenzierter Pandoc-Code gelangt nicht in den Adressraum von Scriptor.

```
┌──────────────┐   subprocess   ┌──────────────┐
│ Scriptor      │ ─────────────→ │ pandoc        │
│ (AGPL-3.0)   │ ←───────────── │ (GPL-2.0+)   │
└──────────────┘   stdout/file  └──────────────┘
```

### Konsequenzen

| Szenario | Lizenzpflicht |
|---|---|
| Scriptor wird ohne Pandoc ausgeliefert | Keine GPL-Pflicht für Pandoc; Nutzer installieren Pandoc separat. |
| Scriptor bündelt Pandoc im Installer | Pandoc bleibt ein separates Werk; der Installer muss GPL-2.0+ für das Pandoc-Binary erfüllen (Source-Angebot, Lizenzhinweis). Scriptor-Code bleibt unter AGPL-3.0+. |
| Scriptor ruft Pandoc zur Laufzeit auf | Keine Pflicht für ein kombiniertes Werk; ein Prozessaufruf ist keine Verlinkung. |
| Scriptor verteilt Pandoc-Filter | Filter, die Pandoc-Module importieren, sind GPL-2.0+-abgeleitete Werke. Von Scriptor erstellte Filter, die nur über stdin/stdout kommunizieren, bleiben separate Werke. |

### Allowlist für `extra_pandoc_args`

Vom Nutzer angegebene `extra_pandoc_args` durchlaufen die Allowlist in `crates/export-runner/src/allowlist.rs`. Dadurch werden beliebige Argument-Injections verhindert und nur dokumentierte, sichere Flags an den Pandoc-Subprozess weitergegeben. Die Allowlist ist eine Sicherheitsgrenze, kein Lizenzmechanismus.

### Gebündeltes Pandoc (optional)

Falls Scriptor Pandoc künftig im Installer bündelt (`SCRIPTOR_BUNDLED_PANDOC_DIR`), muss der Release-Prozess:

1. die eigene Lizenzdatei des Pandoc-Binarys daneben ausliefern;
2. gemäß GPL-2.0 §6 ein schriftliches Angebot für den Pandoc-Quellcode bereitstellen;
3. Pandoc-Version und -Lizenz in den Release Notes dokumentieren.

Diese Pflichten gelten nur für das Pandoc-Binary, nicht für Scriptor selbst.

## Sicherheit

- Exportargumente werden aus strukturierten Rust-Typen aufgebaut, nicht durch Shell-String-Konkatenation.
- `extra_pandoc_args` durchlaufen eine Allowlist in `export-runner`.
- Falls Pandoc später gebündelt wird, muss `export-discover` die festgelegte Versionsmetadaten für Supportdiagnosen ausgeben.
