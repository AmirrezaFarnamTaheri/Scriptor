<div dir="ltr" align="center">
[English](ENCRYPTION-THREAT-MODEL.md) · [فارسی](ENCRYPTION-THREAT-MODEL.fa.md) · [简体中文](ENCRYPTION-THREAT-MODEL.zh-CN.md) · [Русский](ENCRYPTION-THREAT-MODEL.ru.md) · **Deutsch** · [Español](ENCRYPTION-THREAT-MODEL.es.md)
</div>

# Bedrohungsmodell für verschlüsselte Vaults

**Entscheidung:** Verschlüsselung bleibt experimentell. Kryptografische Primitive sind nicht gleichbedeutend mit einem vollständig Ende-zu-Ende verschlüsselten Vault-Produkt.

## Schutzgüter

Markdown-Inhalte, Anhänge, Konfiguration, Indizes, Suchbegriffe, Graph-/Link-Metadaten, Git-Historie, Backups, temporäre Exporte, Logs, Prozessargumente, Schlüssel und Wiederherstellungsmaterial.

## Bedrohungen im Geltungsbereich

- verlorenes oder gestohlenes, ausgeschaltetes Gerät;
- Offline-Kopie eines Vaults oder Backups;
- versehentlich verbleibender Klartext bei Migration/Export/Restore;
- schwache Passphrasen und Parameter-Downgrades;
- Schlüsselverlust und unterbrochenes Rekeying/Migration;
- Metadatenlecks über Pfade, Indizes, Git, Logs, Thumbnails, Swap oder Crash Dumps.

## Bedrohungen, die Dateiverschlüsselung allein nicht löst

Ein kompromittiertes laufendes Betriebssystem bzw. eine kompromittierte Benutzersitzung, ein bösartiger Renderer mit bereits erteilter Autorisierung, Keylogger, feindliche externe Werkzeuge, im Speicher angezeigter Klartext oder Angreifer mit Zugriff auf entsperrtes Keychain-/Sitzungsmaterial.

## Erforderliche Architektur vor einer Hochstufung

1. versionierter Envelope mit Algorithmus-/KDF-Kennungen und Parametern;
2. Wiederherstellungsdesign für OS-Keychain und Passphrase mit expliziter Verlustsemantik;
3. Strategie für Index/Graph/Cache: verschlüsselt oder bewusst ausgeschlossen;
4. atomares Migration-/Rekey-Journal mit Rollback;
5. verschlüsselte externe Backups und Restore-Übung;
6. Git-Richtlinie, die Klartext-Historie verhindert;
7. sichere Behandlung temporärer Dateien und Exporte;
8. unabhängige kryptografische Prüfung, Known-Answer-Tests, Fuzzing, Fault Injection und Tests für Parametermigrationen;
9. UI, die Locked/Unlocked-Zustand und Metadatenlecks korrekt kommuniziert.

## Aktuelle Implementierung

`crates/vault/src/encryption.rs` verwendet authenticated encryption und Argon2id-basierte Passphrasenableitung mit Versionsprüfungen und Negativtests. Es handelt sich um ein prototypisches Bibliotheksmodul, das nicht als transparenter, unterstützter Vault-Modus eingebunden ist. Produkt- und Sicherheitsdokumentation müssen diese Unterscheidung beibehalten.
