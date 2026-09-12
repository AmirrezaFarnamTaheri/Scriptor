# Maintainer

[English](MAINTAINERS.md) · [فارسی](MAINTAINERS.fa.md) · [简体中文](MAINTAINERS.zh-CN.md) · [Русский](MAINTAINERS.ru.md) · **Deutsch** · [Español](MAINTAINERS.es.md)

## Aktueller Maintainer

Amirreza “Farnam” Taheri  
E-Mail: [taherifarnam@gmail.com](mailto:taherifarnam@gmail.com)  
GitHub: [@AmirrezaFarnamTaheri](https://github.com/AmirrezaFarnamTaheri)

## Eigentumsmodell

Die hochgeladene Quellbasis enthält keinen kanonischen Git-Verlauf. Historische Zuständigkeiten und der Bus-Faktor lassen sich daher aus diesem Artefakt allein nicht belegen. Das Repository enthält inzwischen [`.github/CODEOWNERS`](.github/CODEOWNERS), aber die Durchsetzung durch die Hosting-Plattform und die tatsächliche Konzentration von Reviews müssen im kanonischen Repository geprüft werden. Beibehalten werden sollten:

- `CODEOWNERS` für Sicherheits-, Release-, Rust-Kernel-, Frontend- und Dokumentationspfade;
- mindestens zwei Reviewer für Release- und sicherheitskritische Änderungen;
- ein vierteljährlicher Bericht zu Ownership, Churn und Secret-Historie;
- unveränderliche Release-Tags und geschützte Produktionsumgebungen.

Bis weitere Maintainer dokumentiert sind, ist der Lead-Maintainer die Eskalationsinstanz für alle Bereiche. Das ist ein Kontinuitätsrisiko und keine abgeleitete Teamstruktur.

Lokale Verlaufsnachweise aus einem vollständigen Clone erzeugen mit:

```bash
bash scripts/governance/history-audit.sh . .history-audit
```

## Release-Autorität

Produktions-Releases:

1. gehen von einem Tag `v<version>` aus, der mit [`VERSION`](VERSION) übereinstimmt;
2. bestehen `.github/workflows/ci.yml` sowie die Plattform-Compile-/Package-Gates;
3. verwenden das dokumentierte Vertrauensmodell für unsignierte Installer: exakte Quellidentität, SHA-256-Prüfsummen, zielgebundene Trust-Status-Datensätze, SBOM, Release-Receipt und GitHub-Provenance-Attestierungen;
4. befördern exakt die heruntergeladenen Build-Artefakte, ohne während der Veröffentlichung neu zu bauen;
5. veröffentlichen die vom Release-Evidence-Vertrag verlangten Prüfsummen, SBOM, Release-Receipt, Trust-Metadaten und Attestierungen.

Siehe [`docs/RELEASE-SECURITY.de.md`](docs/RELEASE-SECURITY.de.md).

## Support und Eskalation

| Thema | Weg |
|---|---|
| Sicherheit | Private E-Mail gemäß [`SECURITY.de.md`](SECURITY.de.md) |
| Fehler/Funktionen | GitHub Issues |
| Beiträge | [`CONTRIBUTING.de.md`](CONTRIBUTING.de.md) |
| Lizenzierung | [`COMMERCIAL-LICENSING.de.md`](COMMERCIAL-LICENSING.de.md) |
| Capability-Status | [`docs/CAPABILITY-MATURITY.de.md`](docs/CAPABILITY-MATURITY.de.md) |
