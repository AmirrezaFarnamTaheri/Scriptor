# Modelo de amenazas para vaults cifrados

**Decisión:** el cifrado sigue siendo experimental. Disponer de primitivas criptográficas no equivale a ofrecer un producto de vault cifrado de extremo a extremo.

## Activos

Contenido Markdown, adjuntos, configuración, índices, términos de búsqueda, metadatos de grafo/enlaces, historial de Git, copias de seguridad, exportaciones temporales, logs, argumentos de procesos, claves y material de recuperación.

## Amenazas incluidas

- dispositivo apagado perdido o robado;
- copia offline de un vault o backup;
- residuos accidentales de texto plano durante migration/export/restore;
- passphrases débiles y downgrade de parámetros;
- pérdida de claves y procesos de rekey/migration interrumpidos;
- filtración de metadatos mediante rutas, índices, Git, logs, thumbnails, swap o crash dumps.

## Amenazas que el cifrado por archivo no resuelve

Un sistema operativo o una sesión de usuario en ejecución ya comprometidos, un renderer malicioso con autoridad previamente concedida, un keylogger, una herramienta externa hostil, texto plano mostrado en memoria o un atacante con acceso al material de keychain/sesión ya desbloqueado.

## Arquitectura necesaria antes de graduar la capacidad

1. envelope versionado con identificadores y parámetros de algoritmo/KDF;
2. diseño de recuperación mediante OS keychain y passphrase, con semántica explícita de pérdida;
3. estrategia para index/graph/cache cifrada o deliberadamente excluida;
4. journal atómico de migration/rekey con rollback;
5. backups externos cifrados y simulacro de restore;
6. política de Git que impida historial en texto plano;
7. gestión segura de archivos temporales y exportaciones;
8. revisión criptográfica independiente, known-answer tests, fuzzing, fault injection y pruebas de migración de parámetros;
9. UI que comunique con precisión el estado locked/unlocked y la posible filtración de metadatos.

## Implementación actual

`crates/vault/src/encryption.rs` utiliza authenticated encryption y derivación de passphrase basada en Argon2id con comprobaciones de versión y pruebas negativas. Es un módulo de biblioteca prototipo, no un modo de vault transparente y soportado. Los materiales de producto y seguridad deben mantener explícitamente esa distinción.
