[English](RUSTSEC-EXCEPTIONS.md) · [فارسی](RUSTSEC-EXCEPTIONS.fa.md) · [简体中文](RUSTSEC-EXCEPTIONS.zh-CN.md) · [Русский](RUSTSEC-EXCEPTIONS.ru.md) · **Deutsch** · [Español](RUSTSEC-EXCEPTIONS.es.md)

# RustSec-Ausnahmeledger

Dieses Ledger besitzt jede Advisory-Ausnahme, die `cargo-deny` vorübergehend ignoriert. Ein Ignore ist keine Verwerfung: Er dokumentiert eine geprüfte, erreichbare Dependency-Einschränkung mit benanntem Owner, datierter Wiederprüfung und konkreter Exit-Bedingung. Aktualisierbare Schwachstellen bleiben durch CI verboten.

**Owner:** Scriptor Release- und Security-Maintainer  
**Prüfrhythmus:** monatlich und vor jedem Produktions-Tag  
**Letzte vollständige Prüfung:** 2026-09-03  
**Nächste vollständige Prüfung:** 2026-10-01

### Prüfnachweise vom 2026-09-03

- Die ignorierten Advisories für GTK3/Tauri, `proc-macro-error`, `atomic-polyfill`, `paste` und `rust-unic` bleiben RustSec **INFO / unmaintained** ohne gepatchte Versionen. Die gelockten Pakete sind weiterhin vorhanden, weil der unterstützte Tauri/Linux- bzw. transitive Produktgraph in diesem Checkout keinen kompatiblen gepflegten Ersatz bietet.
- `RUSTSEC-2025-0057` (`fxhash`) wurde aus Ledger und `deny.toml` entfernt: `fxhash` ist nicht mehr in `Cargo.lock`; die Ausnahme beizubehalten würde eine spätere Wiedereinführung verbergen statt aktuelle Erreichbarkeit zu dokumentieren.
- Diese Prüfung unterdrückt keine neu veröffentlichten Schwachstellen. `cargo deny` bleibt die Produktionsautorität für Advisories außerhalb dieser exakten Liste; die nächste produktionsfähige Umgebung muss es vor dem Tagging gegen die aktuelle Advisory-Datenbank ausführen.

### Follow-up des Integrationsaudits vom 2026-09-05

Eine frisch geladene RustSec-Datenbank meldete keine Vulnerability-Class-Advisories, 18 unmaintained Pakete und informative Unsoundness-Advisories für `glib` sowie zwei `lru`-Versionen. Die TUI-Abhängigkeit wurde von `lru` 0.18.1 auf die gepatchte 0.18.2 aktualisiert. Tantivy 0.26.1 löst weiterhin `lru` 0.16.4 auf; innerhalb des kompatiblen Releasebereichs gab es keinen Ersatz. Der Linux-Tauri-Stack löst weiterhin `glib` 0.18.5 auf, betroffen von RUSTSEC-2024-0429. Diese zwei verbleibenden Unsoundness-Funde werden **nicht** zur Ignore-Liste hinzugefügt. Sie bleiben Upstream-Dependency-Arbeit und müssen vor einem Produktionsrelease bewertet werden. Der Audit deaktivierte die Yanked-Version-Suche und beweist daher nicht, dass das Lockfile frei von yanked Releases ist.

| Advisory | Dependency-Familie | Erreichbarkeit | Owner | Upstream | Prüfen bis | Exit-Bedingung |
|---|---|---|---|---|---|---|
| RUSTSEC-2024-0370 | GTK/Tauri Linux Desktop Stack | Linux-Desktop-Packaging und Runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0370.html | 2026-10-01 | Entfernen, wenn Tauri/WebKitGTK das betroffene unmaintained Crate nicht mehr auflöst |
| RUSTSEC-2024-0411 | GTK/Tauri Linux Desktop Stack | Linux-Desktop-Packaging und Runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0411.html | 2026-10-01 | Entfernen, wenn der unterstützte Tauri-Linux-Stack einen gepflegten Ersatz hat |
| RUSTSEC-2024-0412 | GTK/Tauri Linux Desktop Stack | Linux-Desktop-Packaging und Runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0412.html | 2026-10-01 | Entfernen, wenn der unterstützte Tauri-Linux-Stack einen gepflegten Ersatz hat |
| RUSTSEC-2024-0413 | GTK/Tauri Linux Desktop Stack | Linux-Desktop-Packaging und Runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0413.html | 2026-10-01 | Entfernen, wenn der unterstützte Tauri-Linux-Stack einen gepflegten Ersatz hat |
| RUSTSEC-2024-0414 | GTK/Tauri Linux Desktop Stack | Linux-Desktop-Packaging und Runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0414.html | 2026-10-01 | Entfernen, wenn der unterstützte Tauri-Linux-Stack einen gepflegten Ersatz hat |
| RUSTSEC-2024-0415 | GTK/Tauri Linux Desktop Stack | Linux-Desktop-Packaging und Runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0415.html | 2026-10-01 | Entfernen, wenn der unterstützte Tauri-Linux-Stack einen gepflegten Ersatz hat |
| RUSTSEC-2024-0416 | GTK/Tauri Linux Desktop Stack | Linux-Desktop-Packaging und Runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0416.html | 2026-10-01 | Entfernen, wenn der unterstützte Tauri-Linux-Stack einen gepflegten Ersatz hat |
| RUSTSEC-2024-0417 | GTK/Tauri Linux Desktop Stack | Linux-Desktop-Packaging und Runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0417.html | 2026-10-01 | Entfernen, wenn der unterstützte Tauri-Linux-Stack einen gepflegten Ersatz hat |
| RUSTSEC-2024-0418 | GTK/Tauri Linux Desktop Stack | Linux-Desktop-Packaging und Runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0418.html | 2026-10-01 | Entfernen, wenn der unterstützte Tauri-Linux-Stack einen gepflegten Ersatz hat |
| RUSTSEC-2024-0419 | GTK/Tauri Linux Desktop Stack | Linux-Desktop-Packaging und Runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0419.html | 2026-10-01 | Entfernen, wenn der unterstützte Tauri-Linux-Stack einen gepflegten Ersatz hat |
| RUSTSEC-2024-0420 | GTK/Tauri Linux Desktop Stack | Linux-Desktop-Packaging und Runtime | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0420.html | 2026-10-01 | Entfernen, wenn der unterstützte Tauri-Linux-Stack einen gepflegten Ersatz hat |
| RUSTSEC-2023-0089 | Transitive Produktabhängigkeit | Produkt-Dependency-Graph; kein sicherer kompatibler Upgradepfad erfasst | Release/Security | https://rustsec.org/advisories/RUSTSEC-2023-0089.html | 2026-10-01 | Bei gepatchtem Parent-Release entfernen oder Parent-Dependency ersetzen |
| RUSTSEC-2024-0436 | Transitive Produktabhängigkeit | Produkt-Dependency-Graph; kein sicherer kompatibler Upgradepfad erfasst | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0436.html | 2026-10-01 | Bei gepatchtem Parent-Release entfernen oder Parent-Dependency ersetzen |
| RUSTSEC-2025-0075 | `rust-unic` über Tauri `urlpattern` | Desktop-URL-Pattern-Parsing | Release/Security | https://rustsec.org/advisories/RUSTSEC-2025-0075.html | 2026-10-01 | Entfernen, wenn Tauri die unmaintained `rust-unic`-Familie ersetzt |
| RUSTSEC-2025-0080 | `rust-unic` über Tauri `urlpattern` | Desktop-URL-Pattern-Parsing | Release/Security | https://rustsec.org/advisories/RUSTSEC-2025-0080.html | 2026-10-01 | Entfernen, wenn Tauri die unmaintained `rust-unic`-Familie ersetzt |
| RUSTSEC-2025-0081 | `rust-unic` über Tauri `urlpattern` | Desktop-URL-Pattern-Parsing | Release/Security | https://rustsec.org/advisories/RUSTSEC-2025-0081.html | 2026-10-01 | Entfernen, wenn Tauri die unmaintained `rust-unic`-Familie ersetzt |
| RUSTSEC-2025-0098 | `rust-unic` über Tauri `urlpattern` | Desktop-URL-Pattern-Parsing | Release/Security | https://rustsec.org/advisories/RUSTSEC-2025-0098.html | 2026-10-01 | Entfernen, wenn Tauri die unmaintained `rust-unic`-Familie ersetzt |
| RUSTSEC-2025-0100 | `rust-unic` über Tauri `urlpattern` | Desktop-URL-Pattern-Parsing | Release/Security | https://rustsec.org/advisories/RUSTSEC-2025-0100.html | 2026-10-01 | Entfernen, wenn Tauri die unmaintained `rust-unic`-Familie ersetzt |

## Prüfverfahren

1. `cargo deny check` und `cargo tree -i <crate>` gegen den gelockten Graph ausführen.
2. Prüfen, ob die Advisory weiterhin nur unmaintained ist oder zu einer ausnutzbaren Schwachstelle geworden ist.
3. Erreichbare Scriptor-Oberfläche und direkten Parent dokumentieren, der die Entfernung verhindert.
4. Ignore sofort entfernen, sobald ein kompatibler gepflegter Pfad existiert.
5. Ein verpasstes `Review by`-Datum als Produktionsrelease-Blocker behandeln.
