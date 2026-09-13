[English](README.md) · [فارسی](README.fa.md) · [简体中文](README.zh-CN.md) · [Русский](README.ru.md) · [Deutsch](README.de.md) · **Español**

# Política de evidencia

La evidencia de publicación se genera desde un checkout Git canónico y limpio, y queda vinculada tanto al commit extraído como a una identidad SHA-256 determinista del árbol fuente. `release-receipt.json`, `scriptor.cyclonedx.json` y `SHA256SUMS` se crean en el job de publicación después de descargar todos los artefactos de plataforma y se verifican antes de cualquier attestation o subida.

Las rutas locales `artifacts/`, `ci-logs/`, `job_log.txt` y `ci.log` son transitorias y están ignoradas. La salida histórica de CI fallida puede conservarse fuera del árbol fuente para diagnóstico, pero nunca se acepta como evidencia de otro commit o candidato de publicación.

El verificador trata el recibo como una allowlist exacta. Un artefacto ausente, un artefacto extra no registrado, un enlace simbólico, una ruta absoluta o con traversal, una entrada de checksum duplicada, deriva del árbol fuente o deriva de metadatos SBOM bloquean la promoción. La generación y verificación de evidencia requieren un checkout Git canónico y limpio; el modo archive existe solo para informes diagnósticos de identidad de fuente y el verificador de promoción no lo acepta.
