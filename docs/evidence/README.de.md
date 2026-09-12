[English](README.md) · [فارسی](README.fa.md) · [简体中文](README.zh-CN.md) · [Русский](README.ru.md) · **Deutsch** · [Español](README.es.md)

# Evidenzrichtlinie

Release-Evidenz wird aus einem sauberen kanonischen Git-Checkout erzeugt und sowohl an den ausgecheckten Commit als auch an eine deterministische SHA-256-Identität des Quellbaums gebunden. `release-receipt.json`, `scriptor.cyclonedx.json` und `SHA256SUMS` entstehen im Publish-Job, nachdem alle Plattformartefakte heruntergeladen wurden, und werden vor Attestierung oder Upload verifiziert.

Lokale Pfade `artifacts/`, `ci-logs/`, `job_log.txt` und `ci.log` sind flüchtig und ignoriert. Historische fehlgeschlagene CI-Ausgaben dürfen zu Diagnosezwecken außerhalb des Quellbaums aufbewahrt werden, werden aber niemals als Evidenz für einen anderen Commit oder Release-Kandidaten akzeptiert.

Der Verifier behandelt den Receipt als exakte Allowlist. Ein fehlendes Artefakt, ein zusätzliches nicht im Receipt enthaltenes Artefakt, ein symbolischer Link, Traversal-/Absolutpfad, ein doppelter Prüfsummeneintrag, Drift des Quellbaums oder Drift der SBOM-Metadaten blockiert die Promotion. Evidenzerzeugung und -prüfung erfordern einen sauberen kanonischen Git-Checkout; Archive Mode existiert nur für diagnostische Berichte zur Quellidentität und wird vom Promotion-Verifier nicht akzeptiert.
