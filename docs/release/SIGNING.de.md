# Vertrauensstatus von Releases und nachgelagerte Signierung

[English](SIGNING.md) · [简体中文](SIGNING.zh-CN.md) · [Русский](SIGNING.ru.md) · **Deutsch** · [Español](SIGNING.es.md) · [فارسی](SIGNING.fa.md)

Scriptor trennt die Integrität der Upstream-Veröffentlichung von den Publisher-Signaturen des Betriebssystems.

## Upstream-Richtlinie

Offizielle GitHub Releases werden bewusst **unsigniert** veröffentlicht:

- kein Windows-Zertifikat ist erforderlich;
- keine Apple Developer ID und keine Notarisierungs-Zugangsdaten sind erforderlich;
- kein privater Linux-OpenPGP-Schlüssel ist erforderlich;
- der Release-Workflow liest keine Signierungsgeheimnisse;
- Vorschau- und Produktions-Releases verwenden dieselbe explizite Unsigned-Richtlinie;
- für die Produktionsveröffentlichung sind dennoch vollständige Prüfsummen-, SBOM-, Receipt-, Source-Identity-, Exact-Subject- und GitHub-Attestation-Nachweise erforderlich.

Damit wird der frühere Widerspruch vermieden, bei dem Releases nominell unterstützt wurden, aber jeder Produktionsjob bereits vor der Kompilierung stoppte, sobald Signierungs-Secrets im Repository fehlten.

## Nachweis des Zielstatus

Jeder Build schreibt `signing-evidence-<platform>-<architecture>.json` nach Schema 2. Der Datensatz enthält:

- Plattform und Architektur;
- Preview- oder Production-Kanal;
- die Werte `signed`, `notarized` und `signatureType`;
- Prüfanweisungen;
- den exakten Source-Commit;
- den Erstellungszeitpunkt.

Der offizielle Workflow schreibt `signed: false`, `notarized: false` und `signatureType: "none"`. Der Veröffentlichungsprüfer verlangt die vollständige Zielmatrix:

- Windows `x86_64`;
- macOS `aarch64`;
- Linux `x86_64`;
- Linux `aarch64`.

Der Prüfer verwirft Duplikate, fehlende oder unerwartete Ziele, falsche Kanäle und abweichende Source-Commits. Bei der Veröffentlichung werden die vier Datensätze nach `release-evidence` verschoben; Receipt-Schema 4 bettet dieselben normalisierten Datensätze ein und prüft die bytegenaue Übereinstimmung mit diesen Metadaten. Trust-Datensätze sind selbst keine Subjects von Installer-Prüfsummen oder Attestations.

## Verhalten der Betriebssysteme

Da die Upstream-Installer unsigniert sind:

- kann Windows SmartScreen einen unbekannten Herausgeber melden;
- kann macOS Gatekeeper verlangen, das Öffnen der App über Systemeinstellungen oder das Finder-Kontextmenü zu bestätigen;
- stützen sich Linux-Pakete auf die heruntergeladene Prüfsumme und die GitHub-Attestation statt auf eine Upstream-OpenPGP-Paketsignatur.

Release Notes müssen diese Einschränkungen deutlich nennen. Die Anwendung darf niemals eine Authenticode-Signatur, Apple-Notarisierung oder OpenPGP-Signatur behaupten, die nicht vorhanden ist.

## Signierung durch nachgelagerte Distributoren

Ein nachgelagerter Distributor darf eine Kopie des Installers mit seinem eigenen Zertifikat oder über den Prozess seines Paket-Repositories signieren. Dadurch entstehen andere Bytes und folglich eine andere Prüfsumme und ein anderes Attestation-Subject als beim Upstream-GitHub-Release.

Ein nachgelagerter Distributor muss:

1. zuerst Upstream-Prüfsumme und GitHub-Attestation verifizieren;
2. Upstream-Receipt und Source-Commit aufbewahren;
3. ausschließlich in seiner kontrollierten Distributionsumgebung signieren;
4. neue Prüfsummen und Anweisungen zur Signaturprüfung unter der eigenen Identität veröffentlichen;
5. niemals Upstream-Assets im offiziellen Scriptor-Release ersetzen.

Das Evidence-Schema kann für unabhängige Werkzeuge ein korrekt signiertes Artefakt darstellen; der offizielle Upstream-CI importiert oder verwendet jedoch kein privates Signierungsmaterial.

## Lokale Validierung

Richtlinie ohne Secrets und Zielmatrix prüfen:

```bash
node scripts/release/validate-signing-policy.mjs \
  --platform linux \
  --architecture x86_64 \
  --channel production
node --test scripts/release/signing-policy.test.mjs
```

Lokalen Unsigned-Status schreiben:

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

Der Release-Verifier bleibt für Integrität und Vollständigkeit fail-closed, auch wenn Publisher-Signierung keine Voraussetzung ist.
