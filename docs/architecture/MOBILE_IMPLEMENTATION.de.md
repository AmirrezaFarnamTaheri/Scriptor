[English](MOBILE_IMPLEMENTATION.md) · [فارسی](MOBILE_IMPLEMENTATION.fa.md) · [简体中文](MOBILE_IMPLEMENTATION.zh-CN.md) · [Русский](MOBILE_IMPLEMENTATION.ru.md) · **Deutsch** · [Español](MOBILE_IMPLEMENTATION.es.md)

# Mobile-Implementierung und -Verifizierung

Die Mobile-Anwendung verwendet den gemeinsamen Editor und einen prozessinternen Rust-Kernel-Adapter. Der Vault-Zugriff folgt dem Mobile-Speicherbereich; Notizen werden anhand von Inhalts-Hashes und dem Verlauf gespeichert, nicht über einen Desktop-Daemon. Für Touch-Bedienelemente, Schreibrichtung und wiederherstellbare Entwürfe besteht gezielte Browser-Testabdeckung.

Die native Kompilierung und das Debug-Paketieren für Android ARM64 sind verifiziert. Die Debug-APK enthält `classes.dex`, `AndroidManifest.xml` und `lib/arm64-v8a/libscriptor_mobile_lib.so`; die ZIP-Integritätsprüfung meldet keinen beschädigten Eintrag. Das Debug-Paket ist 151,488,290 Byte groß, einschließlich einer nicht gestrippten nativen Bibliothek mit 144,335,032 Byte. Dies ist ein Entwicklungsartefakt, keine größenoptimierte Release-Version.

Eine unabhängige Paketprüfung bestätigt eine native AArch64-ELF64-Bibliothek (ELF-Maschine 183). Die installierte Signaturprüfung von Android akzeptiert die APK mit Signature Scheme v2 und einem Unterzeichner. Der SHA-256-Wert der geprüften APK lautet `54eeb734857bce66273a2f30219e62dd1a85d2ee3fccb2d772a0a50a48d94e6e`; er identifiziert dieses lokale Debug-Artefakt und stellt keine Release-Attestierung dar.

Der standardmäßige Android-Befehl stieß beim Staging der nativen Bibliothek auf die Windows-Berechtigungen für symbolische Links. Das Paketierungs-Hilfsprogramm des Projekts akzeptiert eine bereits kompilierte native Bibliothek, kopiert sie in den generierten ARM64-Staging-Pfad und ruft den generierten Build mit einem projekteigenen Debug-Signaturschlüssel auf. Es validiert das Ziel, stellt seine Prozessumgebung wieder her, begrenzt die Worker- und Speichernutzung und lässt den globalen Android-Keystore unverändert. Build-Artefakte und der lokale Debug-Schlüssel werden von Git ignoriert.

Derzeit ist kein Android-Gerät angeschlossen. Geräteinstallation, Lebenszyklus- und Berechtigungsverhalten sowie das Paketieren eines signierten Releases müssen noch verifiziert werden. Für die iOS-Kompilierung und Geräteverifizierung ist eine Apple-Toolchain erforderlich; von diesem Windows-Host aus werden sie nicht als verifiziert ausgewiesen.
