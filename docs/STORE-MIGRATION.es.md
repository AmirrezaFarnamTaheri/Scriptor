[English](STORE-MIGRATION.md) · [فارسی](STORE-MIGRATION.fa.md) · [简体中文](STORE-MIGRATION.zh-CN.md) · [Русский](STORE-MIGRATION.ru.md) · [Deutsch](STORE-MIGRATION.de.md) · **Español**

# Propiedad de los stores del renderer

Los stores poseen estado efímero del renderer, cachés de modelos de lectura, identidad de solicitudes, UI optimista y estado de reintentos. Nunca se convierten en autoridad sobre archivos del vault, secretos, autorización, nonces del daemon ni ejecución nativa de jobs.

## Propiedad actual

| Superficie | Propietario actual | Próxima extracción | Límite |
| --- | --- | --- | --- |
| Routing y payloads de panel | App shell y hook de overlay | `usePanelRouterStore` | Los comandos nativos quedan fuera del store |
| Ciclo de vida del reader y reintento de anotaciones | Panel reader y cola de guardado | `useReaderSessionStore` | El sidecar del vault es la autoridad durable |
| Decisiones de plugins | Estado backend proyectado por bridge | `useCapabilityStore` | El estado del vault y los gates nativos son autoritativos |
| Descubrimiento/drafts/audit MCP | Paneles MCP y hooks de runtime | `useMcpRuntimeStore` | Ejecución y permisos siguen siendo nativos |
| Estado y jobs Git | Paneles/hooks Git | `useGitWorkspaceStore` | Proceso Git, credenciales y escrituras de conflicto siguen nativos |
| Elecciones de conflicto y preview de merge | UI Git | `useConflictResolutionStore` | La escritura Markdown canónica queda en el límite vault/nativo |
| Solicitudes Task/Kanban | Paneles de dominio | `useTaskBoardStore` | IDs de solicitud rechazan respuestas obsoletas; Markdown es la verdad |
| Planes de export/publish | Paneles Export/Publish | `useExportJobStore`, `usePublishPlanStore` | Lanzamiento de procesos y publicación quedan en nativo/CI |
| Navegación/history/tabs | Controladores de editor y navegación | reducer-backed navigation store | Persistencia del editor sigue respaldada por el vault |

## Regla de extracción

Cada extracción debe comenzar con una prueba de carrera/reintento que falle, exponer una máquina de estados tipada (`idle`, `loading`, `success`, `error`, `cancelled`), llevar un identificador de request/job y preservar el límite de autorización nativo. Un store solo está completo cuando se elimina su antiguo propietario, sus consumidores usan el nuevo contrato y el estado duplicado ya no puede divergir.

El paquete actual ya contiene la descomposición de controladores para navegación, orquestación del editor y superficies de paneles. Los stores restantes son seguimientos deliberadamente escalonados, no proveedores duplicados añadidos sin migrar propiedad.

## Referencias visuales

Los límites corresponden a las superficies revisadas en la [galería visual](./VISUAL-REVIEW.es.md):

- routing y disponibilidad de comandos: [command palette](assets/screenshots/command-palette.png)
- estado graph/canvas: [Graph](assets/screenshots/graph.png) y [Canvas](assets/screenshots/canvas.png)
- estado Git/conflicto: [Git panel](assets/screenshots/git-panel.png) y [conflict resolver](assets/screenshots/conflict-resolver.png)
- runtime MCP: [MCP panel](assets/screenshots/mcp-panel.png)
- jobs export/publish: [Publish center](assets/screenshots/publish-center.png)
- preferencias y plugins: [Settings](assets/screenshots/settings.png) y [Plugins](assets/screenshots/plugins.png)
