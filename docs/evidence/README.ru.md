[English](README.md) · [فارسی](README.fa.md) · [简体中文](README.zh-CN.md) · **Русский** · [Deutsch](README.de.md) · [Español](README.es.md)

# Политика доказательств

Release evidence создаётся из чистого канонического Git checkout и привязывается как к извлечённому commit, так и к детерминированной SHA-256 identity дерева исходников. `release-receipt.json`, `scriptor.cyclonedx.json` и `SHA256SUMS` создаются в publish job после загрузки всех platform artifacts, затем проверяются до attestation или upload.

Локальные пути `artifacts/`, `ci-logs/`, `job_log.txt` и `ci.log` временные и игнорируются. Исторический вывод упавшего CI может храниться вне source tree для диагностики, но никогда не принимается как evidence для другого commit или release candidate.

Verifier рассматривает receipt как точную allowlist. Отсутствующий artifact, лишний unreceipted artifact, symbolic link, traversal/absolute path, повторная checksum entry, drift source tree или SBOM metadata блокируют promotion. Генерация и проверка evidence требуют чистого канонического Git checkout; archive mode предназначен только для диагностических отчётов source identity и не принимается promotion verifier.
