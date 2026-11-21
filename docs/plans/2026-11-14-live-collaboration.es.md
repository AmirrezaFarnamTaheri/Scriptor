# Scriptor: plan de implementación de colaboración en tiempo real

[English](2026-11-14-live-collaboration.md) · [فارسی](2026-11-14-live-collaboration.fa.md) · [简体中文](2026-11-14-live-collaboration.zh-CN.md) · [Русский](2026-11-14-live-collaboration.ru.md) · [Deutsch](2026-11-14-live-collaboration.de.md) · **Español**

> Para agentes de ingeniería: ejecutar tareas comprobables por separado y conservar el registro de pruebas de cada incremento.

**Objetivo:** Permitir edición simultánea entre clientes Scriptor con recuperación local, sin presentar el sondeo de Google Docs ni Git de Overleaf como colaboración en vivo.

**Arquitectura:** Un protocolo versionado liga cada actualización al vault, sala, documento, época y participante. Un CRDT de texto compatible con Yjs resuelve concurrencia. La capa nativa conserva el diario local y controla las escrituras; un servidor WSS autenticado solo confirma tras almacenamiento durable. CodeMirror y Monaco envían transacciones incrementales; los proveedores externos tienen adaptadores de proyección independientes.

**Tecnologías:** TypeScript/Node 22, React, CodeMirror 6, Monaco, Rust/Tauri, SQLite WAL, Yjs y WebSocket autenticado.

## Restricciones generales

- Identificación exacta de vault/sala/documento/época/participante; consentimiento explícito para cada documento.
- Los límites vinculantes se mantienen exclusivamente en [Global Constraints](2026-11-14-live-collaboration.md#global-constraints); esta traducción no establece cifras normativas propias.
- Un participante revocado no puede leer ni escribir; un observador no puede escribir. Las respuestas antiguas nunca sustituyen el contexto activo.
- ACK significa que el servidor confirmó una transacción durable, no que recibió un paquete. Los cambios reconocidos localmente deben sobrevivir a reinicios.
- Mantener sin cambios las revisiones inmutables de Drive/Docs, el sondeo limitado, la sincronización Git existente y las protecciones CAS/recuperación.
- No utilizar endpoints privados de Overleaf ni anunciar edición nativa en tiempo real de proveedores sin pruebas.
- Trabajar en rama independiente basada en main; no mezclar con PR #336; mantener borrador hasta cumplir pruebas.

## Tarea 1: Contratos de protocolo y cola de reintentos

**Archivos:** src/lib/liveCollaborationProtocol.ts y su test, src/lib/liveCollaborationQueue.ts y su test.

**Interfaces:** parseLiveCollaborationScope, parseLiveCollaborationEnvelope, PendingCollaborationQueue; los mensajes recibidos son datos no confiables.

- [ ] Escribir pruebas de vault/sala/documento/época incorrectos, base64 inválido, carga excesiva, IDs duplicados, secuencias reutilizadas, ACK ajenos, recuperación y límites de memoria.
- [ ] Registrar el fallo inicial: node --experimental-strip-types --test src/lib/liveCollaborationProtocol.test.ts src/lib/liveCollaborationQueue.test.ts.
- [ ] Implementar validación estricta, reintentos idempotentes, confirmación exacta y conservación de la cola tras error de cuota.
- [ ] Repetir las pruebas hasta pasar; verificar también pnpm check:contracts && pnpm test:source.
- [ ] Confirmar el cambio únicamente después de verificarlo.

## Tarea 2: Diario nativo y proyección de archivos

**Archivos:** crear apps/desktop/src-tauri/src/commands/collaboration_live.rs; actualizar commands/mod.rs y lib.rs; incorporar pruebas nativas.

**Interfaces:** inicio, anexado, pendientes, ACK, repetición, cierre y recibos de proyección CAS.

- [ ] Probar vault incorrecto, enlaces simbólicos, épocas obsoletas, error de fsync, recuperación tras cierre, ACK duplicado, cambios externos y dos escritores simultáneos.
- [ ] Mostrar el fallo anterior a implementar con cargo test -p scriptor-desktop collaboration_live.
- [ ] Crear un diario SQLite WAL con claves únicas, transacciones y límites; usar autorización nativa y guardado CAS, sin permitir sobrescrituras automáticas de archivos divergentes.
- [ ] Ante error, suspender la sesión y mantener el borrador recuperable.
- [ ] Verificar pruebas enfocadas, cargo check --locked y contratos de código; confirmar el incremento separado.

## Tarea 3: Servidor de retransmisión autenticado

**Archivos:** services/collaboration-relay/ con pruebas independientes y documentación operativa.

**Interfaces:** reto criptográfico, identidad pública aprobada, membresía vigente y mensajes SYNC, UPDATE, ACK, RESYNC y revocación.

- [ ] Probar tres participantes, observadores sin escritura, editores revocados, reintentos tras resultados ambiguos, caídas antes/después de commit, reordenación, caducidad y compactación.
- [ ] Ejecutar npm test y constatar el fallo inicial.
- [ ] Añadir WSS obligatorio en producción, comprobación de roles por mensaje, persistencia antes de ACK, compactación con instantáneas/cursores seguros y presencia con TTL.
- [ ] Superar pruebas funcionales, de TLS, seguridad, recuperación y carga; publicar sin conexión remota habilitada por defecto.

## Tarea 4: Sesión y adaptadores de editores

**Archivos:** nuevo src/hooks/useLiveCollaboration.ts; modificar packages/editor/src/codemirror.tsx, src/components/editor/MonacoMarkdownEditor.tsx, src/components/SourceMonacoEditor.tsx y src/hooks/useWorkspaceEditor.ts.

- [ ] Probar edición entre motores, deshacer por autor, cursores remotos, IME, Unicode, cambio de vault/documento y respuestas tardías.
- [ ] Confirmar fallo previo; enlazar transacciones incrementales al CRDT sin reemplazar el modelo completo mediante setValue.
- [ ] Incorporar consentimiento, estado accesible, protección del borrador y una sola autoridad para proyectar cambios en disco.
- [ ] Ejecutar pruebas enfocadas y pnpm check:editor && pnpm check:contracts && pnpm test:e2e; confirmar solo al pasar.

## Tarea 5: Verificación de recuperación y seguridad

**Archivos:** e2e/live-collaboration-workflows.spec.ts y docs/VERIFICATION.md.

- [ ] Ejecutar 100 semillas deterministas, 1.000 cambios por semilla y tres participantes; cubrir particiones, reinicios, ACK perdidos, accesos revocados, instantáneas dañadas y concurrencia local.
- [ ] Registrar y corregir los fallos reales, sin suprimir pruebas.
- [ ] Demostrar convergencia byte a byte, conservación de ediciones confirmadas y rechazo de escrituras no autorizadas.
- [ ] Recoger pruebas del commit exacto, builds empaquetados, revisión TLS y límites; mantener la función experimental hasta verificación real.

## Hitos independientes posteriores

**M2 Overleaf:** Sincronización de todo el proyecto mediante Git oficial, manifiesto seguro, revisión de archivos binarios, dependencias, borrados y conflictos; nunca usar push forzado.

**M3 Google Docs:** Modelo estructurado de pestañas, estilos, listas, vínculos y tablas; cambios selectivos mediante batchUpdate y revisiones; rechazar pérdidas silenciosas.

**M4 Conciliación:** Puntos de control del proveedor separados de los ACK del CRDT y revisión explícita de divergencias.

**M5 Editor nativo Overleaf:** Solo mediante una interfaz oficial verificada.

**Decisión:** Despliegue inicial autoalojado sin cifrado de extremo a extremo, con aviso explícito del acceso potencial del operador del servidor. Alojamiento administrado, escrituras automáticas en proveedores e interfaces no oficiales requieren aprobación aparte.
