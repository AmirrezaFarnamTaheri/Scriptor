# Operaciones y diagnóstico

## Tracing estructurado

Desktop, daemon y CLI inicializan tracing JSON estructurado mediante `crates/system-bridge/src/observability.rs`. Los campos cuyos nombres indiquen secret/token/password/key se redactan. Los archivos locales rotan por tamaño y conservan un número acotado de segmentos.

## Correlación

Las operaciones largas o que cruzan fronteras deben transportar el mismo operation/request ID a través del comando del renderer, el adaptador Tauri/daemon, el receipt del proceso externo y el evento de auditoría. Un informe de fallo debe poder diagnosticarse por ese ID sin necesidad de leer el código fuente.

## Señales de salud

- generación del watcher y estado rescan-required;
- generación/frescura del índice;
- pérdidas de subscribers del daemon;
- resultados de timeout/cancel/truncation de procesos;
- intents MCP pendientes;
- verificación de backup y restore journal;
- estado de log rotation/repair.

## Recopilación de incidentes

Utiliza únicamente diagnósticos redactados. Nunca adjuntes un vault real, valores del keychain, un request body completo ni un audit log sin revisar. Conserva el source commit, la versión de la aplicación, OS/arch, la reproducción, el operation ID y el segmento de log acotado más pequeño que sea relevante.

## Paquete de soporte

Settings → Diagnostics → **Export redacted support bundle** escribe un artefacto JSON de soporte acotado en `.scriptor/diagnostics/`. Incluye identidad de aplicación/sistema, recuentos agregados de salud del vault y como máximo 100 eventos de diagnóstico del cliente ya redactados. Excluye deliberadamente la raíz del vault, rutas y contenido de notas, request bodies y credenciales. El client diagnostic journal rota a 2 MiB y limita el tamaño de message/detail antes de persistirlos.
