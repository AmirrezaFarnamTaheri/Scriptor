# Producto

**Scriptor** · *La herramienta para escritura exigente* · fuente de versión: [`VERSION`](VERSION)

## Posicionamiento

Scriptor es un espacio de trabajo Markdown local-first para escritura e investigación exigentes. Combina escritura, gestión de evidencia, citas, navegación por grafo, revisión consciente de Git, publicación reproducible y automatización con permisos, manteniendo los archivos Markdown del disco como fuente autoritativa.

## Contexto operativo

- La aplicación de escritorio Tauri es la superficie principal del producto.
- La shell web se usa para desarrollo y pruebas visuales.
- daemon, CLI/TUI, servidor MCP y catálogo restringido de plugins son extensiones operativas del mismo modelo de vault.
- Mobile, vaults cifrados, embeddings, Tantivy y el host WASM siguen siendo experimentales o design-only según [`docs/CAPABILITY-MATURITY.es.md`](docs/CAPABILITY-MATURITY.es.md).

## Evidencia disponible

Las afirmaciones del producto se apoyan en artefactos del repositorio, no en lenguaje de roadmap:

- [`README.es.md`](README.es.md) define la postura actual de release y los puntos de entrada soportados.
- [`docs/CAPABILITY-MATURITY.es.md`](docs/CAPABILITY-MATURITY.es.md) separa capacidades implementadas, experimentales y solo diseñadas.
- [`docs/ARCHITECTURE.es.md`](docs/ARCHITECTURE.es.md) registra la propiedad de componentes y las fronteras de confianza.
- [`docs/VERIFICATION.es.md`](docs/VERIFICATION.es.md) define qué demuestran las comprobaciones actuales y qué exige evidencia en un entorno limpio.
- [`DESIGN.es.md`](DESIGN.es.md) define requisitos de interacción, accesibilidad y sistema visual.

## Principios de producto

1. **Los archivos siguen siendo autoritativos.** Markdown permanece portable, inspeccionable y recuperable.
2. **La autoridad es explícita.** Las acciones native, network, process, plugin, MCP, backup, publishing y destructive cruzan fronteras de permisos con nombre.
3. **El trabajo está acotado.** Scans, recorridos de grafo, process output, logs, queues y registros retenidos tienen límites explícitos.
4. **Las mutaciones son recuperables.** Los cambios de alto impacto exponen alcance, efectos secundarios ordenados, estado de fallo y evidencia de restauración.
5. **La madurez se expresa con honestidad.** El comportamiento implementado, el trabajo experimental y las opciones de diseño nunca se presentan como garantías equivalentes.
6. **El espacio de trabajo sirve a la escritura.** Navegación, diagnóstico y automatización apoyan al documento en lugar de desplazarlo.

## Usuarios y trabajo principal

Scriptor sirve a escritores, investigadores, estudiantes, autores técnicos y knowledge workers que mantienen vaults Markdown de larga duración. Lo usan para capturar material, conectar evidencia, redactar y revisar textos extensos, gestionar citas, inspeccionar la calidad del conocimiento, publicar de forma reproducible y automatizar tareas acotadas sin ceder la propiedad de sus archivos.

## Promesa del producto

1. Los archivos Markdown permanecen portables y autoritativos.
2. Antes de una acción de alto riesgo, el usuario puede entender qué se leerá, escribirá, enviará, ejecutará o eliminará.
3. El estado de index, graph, Git, export y backup es observable y recuperable.
4. El entorno de escritura se mantiene tranquilo y legible incluso con investigación densa.
5. Las capacidades experimentales están etiquetadas y nunca se presentan como garantías ya distribuidas.

## Superficies soportadas

| Superficie | Madurez |
|---|---|
| Web development shell | soportada para desarrollo y pruebas visuales |
| Tauri desktop (Windows, macOS, Linux) | superficie principal del producto |
| Headless daemon y CLI/TUI | superficies operativas soportadas |
| MCP stdio integration | soportada con scoped tools y audit records duraderos |
| Plugin catalog | plataforma manifest-first, restringida y experimental |
| Google Calendar y Tasks | integraciones desktop experimentales y opt-in |
| Mobile, encrypted vaults, embeddings, Tantivy, WASM host | experimentales o design-only |

La matriz autoritativa es [`docs/CAPABILITY-MATURITY.es.md`](docs/CAPABILITY-MATURITY.es.md).

## Medidas de éxito

- ninguna pérdida silenciosa de datos ni cross-vault mutation;
- memoria y latencia acotadas a medida que crece el vault;
- releases reproducibles y atribuibles al source, con trust status explícito, checksums, SBOM CycloneDX, receipts y provenance attestations;
- flujos completos por teclado y conformes con WCAG 2.2 AA;
- un contribuidor nuevo puede localizar ownership, contracts, tests y operational evidence sin arqueología;
- los flujos principales funcionan sin acceso externo a red, salvo servicios habilitados explícitamente.

## Exclusiones del producto

- almacenamiento propietario como source of truth;
- autoridad ambiental de AI o plugins;
- fallbacks de red ocultos;
- navegación chat-first que desplace la escritura;
- dashboard chrome decorativo que reduzca el área de trabajo;
- afirmaciones de seguridad sobre cifrado prototipo o código de terceros sin aislamiento;
- canales de producción que oculten o tergiversen el trust status intencionadamente unsigned de los instaladores oficiales upstream.

## Modelo operativo

Scriptor es local-first. El renderer se considera no confiable respecto a la autoridad native. Tauri commands, daemon RPC, MCP, procesos externos, Git, acceso a keychain y backup/restore son fronteras explícitas. Los logs y audit records locales están acotados y redactados; los mutation records de alta integridad se encadenan por hash.

## Política de roadmap

Los roadmap describen opciones, no comportamiento actual. Una capability solo se gradúa cuando tiene:

- owner y source entry point definidos;
- semántica explícita de trust y failure;
- tests positivos, negativos, de restart, cancellation y recovery;
- modelo authorization/privacy;
- evidencia de rendimiento acotada;
- documentación de usuario y operador;
- release inclusion y support status en el capability ledger.
