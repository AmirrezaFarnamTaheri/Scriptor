# Política de seguridad

[English](SECURITY.md) · [فارسی](SECURITY.fa.md) · [简体中文](SECURITY.zh-CN.md) · [Русский](SECURITY.ru.md) · [Deutsch](SECURITY.de.md) · **Español**

## Informar de una vulnerabilidad

No abra un issue público si sospecha de una vulnerabilidad. Envíe un correo a **taherifarnam@gmail.com** e incluya:

- versión o commit afectado;
- entorno y requisitos previos;
- pasos reproducibles o prueba de concepto;
- impacto y límites de datos o autoridad que se hayan atravesado;
- embargo propuesto o necesidades de coordinación.

No incluya secretos reales ni datos personales de terceros. Los informes se acusan de recibo tan pronto como sea razonablemente posible; el calendario de divulgación se coordina una vez comprendidos el impacto y la remediación.

## Versión compatible

Solo la versión etiquetada actual y la rama `main` actual reciben correcciones de seguridad. La identidad de la versión se determina mediante [`VERSION`](VERSION).

## Límites de confianza

- **Renderer:** se considera no confiable frente a las capacidades nativas de sistema de archivos, llavero, procesos, copias de seguridad, Git, red y publicación.
- **Comandos de Tauri:** se clasifican por operación; los comandos sensibles requieren una autorización nueva, de un solo uso y limitada al ámbito correspondiente, emitida tras la confirmación nativa del usuario.
- **Daemon/IPC:** endpoint local para el mismo usuario con metadatos del endpoint protegidos por HMAC, un nonce por endpoint obligatorio en cada solicitud y suscripción a eventos, mensajes tipados/versionados, frames/colas acotados, resuscripción autenticada automática y resincronización explícita del estado tras la interrupción del flujo de eventos. En Windows, la seguridad de endpoints TCP locales o named pipes depende de autenticación mediante bearer token HMAC-SHA256 almacenado en `%LOCALAPPDATA%` del usuario o en OS Credential Manager, no de permisos de sistema de archivos de sockets Unix.
- **MCP:** herramientas explícitas, registros persistentes de auditoría intent/outcome, claves de idempotencia, logs acotados y recuperación de intents pendientes.
- **Herramientas externas/code chunks:** se ejecutan mediante el process broker con resolución del ejecutable, saneamiento del entorno, política de red, límites de tiempo/salida, cancelación del árbol de procesos y receipts.
- **Plugins:** el runtime actual es restringido y manifest-first; el consentimiento de permisos, la distribución de terceros firmada y la ejecución aislada siguen siendo requisitos para su maduración.
- **Proveedores de IA:** las credenciales permanecen dentro del límite del llavero nativo; Rust realiza las llamadas de red únicamente a través de endpoints validados y no expone secretos sin procesar a JavaScript.

## Datos y privacidad

Scriptor es local-first y no requiere telemetría. Los diagnósticos son opt-in y solo deben incluir campos permitidos y redactados. PlantUML remoto y las fuentes remotas están deshabilitados. Toda integración remota opcional debe indicar expresamente el endpoint y los datos enviados.

## Estado del cifrado

`crates/vault/src/encryption.rs` contiene primitivas criptográficas versionadas y pruebas. **Los vaults cifrados son experimentales y no constituyen una capacidad de seguridad integral de extremo a extremo compatible.** Los índices, las copias de seguridad, el historial de Git, los archivos temporales, las fugas de metadatos, la recuperación de claves y las migraciones no quedan resueltos únicamente mediante una primitiva por archivo. Consulte [`docs/ENCRYPTION-THREAT-MODEL.es.md`](docs/ENCRYPTION-THREAT-MODEL.es.md).

## Integridad de las versiones

Los instaladores oficiales de producción del upstream se publican intencionadamente sin firma. Sus registros de confianza indican de forma explícita que no hay firma de plataforma ni notarización. En su lugar, una publicación de producción exige para cada destino un registro explícito de estado de confianza, checksums SHA-256, un SBOM CycloneDX, un release receipt inmutable, la identidad exacta del código fuente y attestations de procedencia de GitHub. Instrucciones de verificación: [`docs/RELEASE-SECURITY.es.md`](docs/RELEASE-SECURITY.es.md).
La secuencia go/no-go de producción se encuentra en [`docs/RELEASE-CHECKLIST.es.md`](docs/RELEASE-CHECKLIST.es.md); el vocabulario actual de evidencias y las áreas aún no verificadas se registran en [`docs/VERIFICATION.es.md`](docs/VERIFICATION.es.md).

## Política de dependencias y CI

- los lockfiles son entradas de validación y los jobs de auditoría no deben modificarlos;
- las GitHub Actions externas usan SHAs inmutables y revisados, con comentarios de versión exactos;
- Node, pnpm, Rust, runners y herramientas de release están fijados a versiones concretas;
- CI ejecuta `cargo deny`, `pnpm audit --prod` y gates de pins de actions, versión, límites, documentación y contratos de código fuente;
- las actualizaciones de dependencias se realizan en cambios separados y revisados.
