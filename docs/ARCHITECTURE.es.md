# Arquitectura actual

[English](ARCHITECTURE.md) · [简体中文](ARCHITECTURE.zh-CN.md) · [Русский](ARCHITECTURE.ru.md) · [Deutsch](ARCHITECTURE.de.md) · **Español** · [فارسی](ARCHITECTURE.fa.md)

**Estado:** mapa de la implementación actual. La versión canónica del producto está en [`VERSION`](../VERSION); las propuestas solo de diseño viven en documentos separados y están marcadas en [`CAPABILITY-MATURITY.md`](CAPABILITY-MATURITY.md).

## Topología de runtime

```text
React renderer
  -> typed bridge commands
  -> Tauri command adapters
  -> authorization broker
  -> application/kernel crates
       vault | indexer | native-git | export-runner | canvas-engine
  -> filesystem / SQLite / Git / keychain / approved external tools

CLI/TUI and MCP
  -> daemon IPC (scriptor-ipc envelopes)
  -> daemon handlers and shared kernel crates
```

El renderer no es una frontera de autoridad. Las operaciones nativas validan scope, authorization, runtime payloads, paths, process policy y cancellation de forma independiente al estado de la UI.

## Planos y propiedad

| Plano | Owner | Responsabilidades |
|---|---|---|
| Product shell | `src/App.tsx`, `src/components/shell/`, `src/components/app/QuickCaptureWorkspaceLayer.tsx`, `src/components/app/WorkspaceRenameDialogs.tsx`, `src/hooks/` | composición del workspace, workflows de capture/rename y presentation state |
| Runtime validation | `src/lib/runtimeSchema.ts`, `src/types/vaultValidators.ts` | parsear payloads no confiables de bridge/storage |
| Native adapter | `apps/desktop/src-tauri/src/commands/` | solo mapping Tauri argument/result |
| Authorization | `apps/desktop/src-tauri/src/authorization.rs` | grants operation/scope de un solo uso y confirmación nativa |
| Vault | `crates/vault/` | safe paths, notes, config, scans, watcher events, audit records |
| Index | `crates/indexer/` | SQLite current schema, FTS, backlinks, graph y knowledge queries |
| Git | `crates/native-git/` | operaciones noninteractive status/diff/commit/conflict |
| External tools | `crates/system-bridge/src/process.rs` | executable policy, sanitized env, sandbox, bounds, cancellation, receipts |
| Daemon transport | `crates/daemon/`, `crates/ipc/` | authenticated local RPC, frame bounds, resynchronizing event delivery, jobs, MCP bridge; el command catalog tiene ownership separado del dispatch |
| Desktop git serialization | `crates/native-git/src/queue.rs`, `apps/desktop/src-tauri/src/state.rs` | las cinco mutaciones Git nativas pasan por bounded per-repo GitQueue worker con 64-slot backpressure; el handle se reinicia en vault swap; los comandos read-only whole-vault se despachan fuera del daemon state mutex mediante session-clone seam |
| Observability | `crates/system-bridge/src/observability.rs` | structured, redacted, bounded local tracing |
| Export | `crates/export-runner/`, `packages/export/` | profiles, preflight, diagrams, Pandoc orchestration |
| Publish | `crates/publish-runner/`, adaptadores desktop/CLI | frontmatter-gated plan/review/apply, managed local Starlight output, stale-plan y output-drift protection |
| UI packages | `packages/*` | deep modules expuestos solo por package exports; MCP tool contracts/catalog separados de runtime state y dispatch |

## Flujos principales

### Abrir e indexar un vault

1. Renderer solicita abrir un vault mediante typed bridge.
2. Native adapter valida el path y actualiza scoped state.
3. Metadata discovery se separa de bounded content parsing.
4. Indexer aplica una generation y guarda notes/links/FTS en SQLite.
5. Watcher agrupa cambios incrementales; overflow/error emite `RescanRequired`.
6. Desktop y daemon ignoran stale generations y ejecutan la misma recuperación full-rebuild.

### Mutar una note mediante MCP

1. Validar tool y vault scope.
2. Persistir y hacer `fsync` de un intent con idempotency key y hash-chain link.
3. Ejecutar la atomic vault mutation.
4. Añadir outcome. Si el proceso se detiene entre intent y outcome, startup reconciliation resuelve determinísticamente el pending record.

### Commit de archivos seleccionados

`crates/native-git/src/status.rs` crea un índice temporal aislado inicializado desde `HEAD`, stagea los paths literales solicitados, crea el commit tree, actualiza la branch y deja sin cambios el índice original del usuario.

### Leer documentos del vault

Reader solo acepta paths PDF/EPUB relativos al vault en el native boundary. Native code resuelve y confina cada path antes de devolver bytes; renderer usa assets PDF/EPUB viewer incluidos y guarda annotations atómicamente en el vault sidecar. Reader se activa primero desde command palette, sin afirmar un shortcut predeterminado.

### Actualizar tasks y tarjetas Kanban

Las tasks se indexan desde Markdown y los cambios se escriben en la note de origen mediante canonical vault save path antes de ejecutar la native mutation. Kanban es una vista Markdown alternativa: mover una card reescribe el archivo fuente trasladando la línea completa bajo el heading `##` solicitado y luego actualiza el index. Ambos caminos rechazan source state stale o inválido en lugar de aplicar silenciosamente un cambio optimista solo en UI.

### Publicar un sitio Starlight local

1. Desktop o CLI solicita a `crates/publish-runner` un plan read-only derivado de un bounded symlink-aware vault scan.
2. Solo notes con `publish: true` son candidatas; sealed content se rechaza después del opt-in gate.
3. Desktop muestra items new/changed/orphaned para review. Apply es una native-authorized mutation separada.
4. Apply recalcula eligibility y content hashes, rechaza selections stale o inventadas por renderer y elimina solo fresh paths previamente propiedad de publish state.
5. Managed output usa atomic writes y rechaza traversal, symlink indirection, source/output containment y unmanaged overwrites. Las páginas generadas ausentes o modificadas manualmente conservan managed ownership, pero aparecen changed en el siguiente plan para que un apply revisado pueda repararlas.

### Proceso externo

Todos los launches soportados pasan por process broker. La policy incluye canonical executable resolution, optional binary hash, trusted workspace, environment allowlist, network policy, límites de time/output, process group/job cancellation y structured outcome. Ningún command se construye concatenando una shell string.

### Backup y restore

- `.scriptor/snapshots` locales son snapshots rápidos de recovery.
- External targets producen backups de disaster recovery en un directorio ligado al vault.
- Cada backup tiene un versioned SHA-256 manifest.
- Restore verifica path, size, hash y vault binding antes de promotion y registra un crash-visible restore journal.

## Modelo de datos y controles de escala

SQLite usa WAL, foreign keys, busy timeouts, current-schema validation, FTS y secondary indexes sobre vault/path y link adjacency. Las Graph APIs son bounded y conservan BFS depth/parent/path. Knowledge summaries y link resolution usan batch/aggregate queries. Los scans limitan file count y note size.

## Fronteras de confianza y fallo

| Boundary | Failure policy |
|---|---|
| Renderer -> native | validate, authorize, reject unknown/expired scope |
| Runtime JSON | parse desde `unknown`; quarantine corrupt persisted state |
| Filesystem | vault confinement, sin symlink/traversal escape |
| SQLite | current-schema validation; explicit busy/error surfaces |
| Watcher | generation IDs y full-rescan recovery |
| Event subscribers | bounded nonblocking queues; slow consumers se desconectan; authenticated resubscription emite `ResyncRequired` antes de reanudar delivery normal |
| Subprocess | timeout/cancel/process-tree kill; bounded stdout/stderr |
| Logs/audit | redaction, size rotation, bounded tail; mutation log hash chain |
| Release | immutable action pins, version contract, explicit unsigned trust records, checksums/SBOM/receipt, provenance attestations |

## Trabajo de arquitectura conocido

### Flujos revisados de fuentes, sincronización y renderizado

Las superficies de investigación usan los límites existentes del vault e indexador. Las ediciones de tablas guardan primero el editor y retienen la revisión mostrada originalmente; fuentes cambiadas requieren recarga y revisión. Capture y Zotero muestran una vista previa antes de escribir un destino ausente en el vault original. Las credenciales permanecen en memoria; cambiar la clave reinicia la paginación.

PDF/EPUB están limitados a 128 MiB; imágenes ráster/audio a 32 MiB, excluyendo SVG/HTML activos. Se validan MIME y se revocan URL de objetos al cambiar fuente o desmontar. El protocolo Reader sirve código empaquetado, no rutas arbitrarias.

Los recibos vinculan publicación con huellas de fuente/salida. El despliegue utiliza una instantánea privada temporal acotada, verificada contra el recibo y eliminada al finalizar. Estos adaptadores siguen experimentales hasta disponer de evidencia de paquetes y proveedores reales.

El renombrado guarda borradores antes de mutaciones nativas. Un fallo conserva el borrador y aborta; las reescrituras respetan revisión/navegación y comprobaciones nativas de fuente obsoleta. Los nombres únicos protegen backups antiguos. La actividad lee como máximo los últimos 256 KiB y devuelve 200 registros válidos; rechaza entradas mayores de 16 KiB y compacta historiales mayores de 1 MiB bajo bloqueo. La recuperación de renombrados se conserva aparte sin poda automática.

Las citas se resuelven en nodos de texto con la bibliografía actual antes de sanear. Los grupos conservan prefijos, localizadores y supresión de autor; claves ausentes mantienen la fuente con marca accesible. Código, enlaces y citas existentes quedan excluidos. La vista autor/año no modifica Markdown ni sustituye CSL.

`useWorkspaceShortcutPreferences` valida datos locales versionados y acotados; `WorkspaceShortcutBar` solo resuelve el catálogo actual. Etiquetas y tamaños no contienen órdenes ejecutables. Un fallo conserva el borrador; la paleta recupera filas ocultas.

`useWorkspaceComposition` vincula hojas validadas a dos grupos de paneles. Restaurar referencias no activa propietarios; navegar requiere su aprobación. Ocultar/mover pestañas conserva propietarios montados y los diálogos anidados impiden ocultarlos. Cada hoja decide su ciclo de vida; editores modificados se muestran secuencialmente. El editor principal es único; hojas Markdown auxiliares son instantáneas de solo lectura. El gestor de módulos comprueba manifiesto y política actual de plugins antes de persistir preferencias.

Los archivos fuente independientes usan `commands/source_files.rs`, una lista explícita de formatos, UTF-8 acotado, guardado por hash, creación estricta y recuperación inmutable. No entran en metadatos/historial de prosa Markdown. Las decisiones de cambios sin guardar concluyen antes de cambiar vault; las reemplazadas no bloquean indefinidamente.

`calendar_sync` guarda vínculo público de carpeta/transporte y cliente OAuth, sin migración necesaria. Drive/Docs, Calendar/Tasks y Gmail tienen tres registros independientes de keychain y permisos específicos. Discovery valida páginas acotadas, rechaza respuestas parciales y ciclos y conserva roles de escritura Calendar. Cambiar cuenta invalida revisiones y consumidores; generaciones OAuth nativas impiden que un login tardío restaure credenciales desconectadas. Eliminar una credencial local no revoca todo el permiso Google; eso requiere una acción explícita en la cuenta.

Las continuaciones retienen vault/cuenta de origen. Cambiar cuenta invalida discovery, mensajes, revisiones e importaciones. Los bloques Planner son locales; mappings/baselines pertenecen a la cuenta y calendario/lista confirmados. Tras desmontaje, respuestas tardías no sobrescriben el planner activo. Gmail revisa contexto antes de guardar, indexar y navegar; una escritura enviada puede concluir, pero se suprimen efectos posteriores obsoletos.

Drive JSON y Docs opaco comparten revisión/conflicto y autorización nativa única. Docs comprueba sobre canónico y checksum preservando bytes Markdown. La conversión rich text tiene revisión separada y no transporta medios. [Guía Google](guides/GOOGLE_INTEGRATIONS.es.md).

Overleaf usa Git de host fijo mediante el broker. Un repositorio aislado conserva el índice remoto completo y materializa solo el blob elegido; verificaciones de objetos evitan filtros de texto. HEAD y contenido revisados preceden pushes ordinarios sin force; la aplicación local utiliza CAS de contenido.

Los kernels Python persistentes son procesos del broker propiedad del vault, con vida finita, permiso por celda ligado a fuente, salida acotada y plots propios. Una guarda nativa evita registro tardío; cambiar vault/restaurar detiene kernels anteriores. Otros lenguajes se ejecutan por separado.

Graphviz usa WebAssembly empaquetado en un worker cancelable con plazo. Fences DOT y Diagram studio comparten cliente; SVG se muestra como imagen pasiva. La composición PDF offline sigue nativa con instantáneas confinadas, avisos empaquetados y publicación única. Las pruebas frontend no acreditan paquetes ni proveedores reales.

Adapter layer conserva una composition root, pero quick capture, rename transactions, deletion, telemetry, shortcuts, sidebar actions, auxiliary workspace data, settings vault configuration, MCP tool contracts, daemon command catalog/support, daemon transport tests, CLI command-line schema y CLI benchmarks ya tienen owners definidos. La descomposición adicional avanza mediante vertical workflows caracterizados sobre typed application services, no mediante un big-bang rewrite. Véase el capability ledger.
