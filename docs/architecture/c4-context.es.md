# Especificación del modelo C4: contexto del sistema de nivel 1 de Scriptor

[English](c4-context.md) · [简体中文](c4-context.zh-CN.md) · [Русский](c4-context.ru.md) · [Deutsch](c4-context.de.md) · **Español** · [فارسی](c4-context.fa.md)

**Estado:** contexto de la implementación actual de Scriptor `1.0.0`, junto con el endurecimiento aún no publicado en este árbol. Las superficies experimentales y solo de diseño se rigen por [`../CAPABILITY-MATURITY.md`](../CAPABILITY-MATURITY.md).

## Resumen del sistema

Scriptor es un espacio de trabajo de escritorio local-first para conocimiento y escritura en Markdown. El Markdown del sistema de archivos del usuario es la fuente de verdad; los índices SQLite y los artefactos generados de publicación/exportación son estado derivado.

## Personas

| Persona | Objetivo principal | Flujos implementados |
|---|---|---|
| Investigador | Escribir y organizar notas bibliográficas y borradores | Edición Markdown, inspección local de bibliografía/citas, lectura y anotaciones PDF/EPUB, grafo/búsqueda |
| Redactor técnico | Producir documentación estructurada | Editor/vista previa, perfiles de exportación, flujos Git, publicación local Starlight revisada |
| Trabajador del conocimiento | Mantener una base de conocimiento personal y portable | Indexado del vault, búsqueda de texto completo, backlinks/grafo, tareas/Kanban, captura |

## Contexto del sistema

```mermaid
C4Context
    title Contexto del sistema Scriptor

    Person(user, "Usuario / Autor", "Es propietario del vault local y autoriza explícitamente las acciones privilegiadas.")
    System(scriptor, "Scriptor", "Espacio de trabajo de escritorio Tauri local-first con CLI/TUI, daemon y superficies de extensión MCP.")

    System_Ext(git_remote, "Git Remote", "Hosting Git opcional configurado por el usuario y alcanzado por el subsistema Git nativo.")
    System_Ext(ai_provider, "AI Provider", "Endpoint HTTPS opcional de generación de texto aprobado por el usuario; las credenciales permanecen en la capa nativa.")
    System_Ext(google, "Google Calendar / Tasks APIs", "Integración OAuth2 PKCE opcional con tokens almacenados en el keychain del sistema operativo.")
    System_Ext(export_tools, "Toolchain local de exportación", "Binarios locales Pandoc/Typst y relacionados instalados por el usuario y usados en flujos explícitos de exportación.")

    Rel(user, scriptor, "Escribe, busca, revisa y autoriza acciones", "UI de escritorio nativa / CLI")
    Rel(scriptor, git_remote, "Push / pull cuando se invoca explícitamente", "system git mediante HTTPS/SSH configurado por el usuario")
    Rel(scriptor, ai_provider, "Envía una solicitud de borrador aprobada", "HTTPS nativo")
    Rel(scriptor, google, "OAuth/conexión, lecturas de calendario y mutaciones de tareas", "OAuth2 PKCE + HTTPS")
    Rel(scriptor, export_tools, "Ejecuta operaciones locales de exportación aprobadas", "subproceso acotado / excepción documentada del broker")
```

El repositorio contiene un paquete connector de solo lectura para Zotero Web API, pero **no está integrado en el runtime desktop/CLI/daemon distribuido** y por tanto no se representa como una relación activa con un sistema externo.

## Fronteras de confianza

1. **Vault local:** Markdown y los recursos del usuario siguen siendo autoritativos en disco. Los índices derivados y la salida de publicación son reconstruibles.
2. **Frontera renderer/native:** el renderer no recibe autoridad sobre filesystem, keychain, Git, red, procesos, backups o publicación. El código nativo vuelve a validar rutas, payloads y grants sensibles.
3. **Frontera daemon:** CLI/TUI y daemon MCP usan el protocolo local tipado `scriptor-ipc` con metadatos de endpoint autenticados, comprobaciones nonce y framing acotado. Es distinto del IPC del renderer Tauri.
4. **Procesos externos:** los lanzamientos soportados pasan por el process broker, salvo excepciones estrechas y documentadas que mantengan límites y política equivalentes.
5. **Red externa:** las integraciones Git, AI y Google son opt-in y usan autenticación específica. No existe fallback de red ambiental.
