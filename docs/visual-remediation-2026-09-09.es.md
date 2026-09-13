[English](visual-remediation-2026-09-09.md) · [فارسی](visual-remediation-2026-09-09.fa.md) · [简体中文](visual-remediation-2026-09-09.zh-CN.md) · [Русский](visual-remediation-2026-09-09.ru.md) · [Deutsch](visual-remediation-2026-09-09.de.md) · **Español**

# Remediación visual — 2026-09-09

Esta checklist sigue la segunda revisión mediante visión nativa del workspace de Windows y superficies relacionadas. Se conserva intencionadamente en la rama de implementación para que cada corrección pueda integrarse y verificarse de forma incremental.

## P1 — arquitectura de información de shell y editor

- [x] Reducir la toolbar persistente de tres filas a una fila principal con disclosure progresivo para herramientas secundarias.
- [x] Eliminar duplicación semántica entre Source/Preview/Split e iconos de opciones del editor.
- [x] Diferenciar visual y semánticamente estados de modo activo, toggle y comando momentáneo.
- [x] Reducir densidad de comandos en la barra superior y consolidar entradas duplicadas.
- [x] Aclarar scopes de búsqueda global, búsqueda de notas y command palette: el trigger global es explícitamente `Commands and notes`, la sidebar solo busca notas y la palette explica cuándo empieza la búsqueda de notas.
- [x] Eliminar navegación redundante `Vault`/notas recientes y aclarar acciones utilitarias de la sidebar.
- [x] Reducir chrome en modo split y conservar anchuras útiles de editor/preview.
- [x] Simplificar chrome inferior de status/output en dos niveles; eliminar affordances Jobs duplicadas y ruido de progreso completado.
- [x] Priorizar problemas reales sobre estado pasivo de subsistemas.

## P1 — confianza, estado y nomenclatura

- [x] Reconciliar métricas de citas del inspector y distinguir métricas de nota frente a vault.
- [x] Sustituir Note Health / Note quality solapados por health a nivel de vault y Publish readiness a nivel de nota.
- [x] Eliminar colisión del nombre Preview entre modo del editor y tab del inspector (`Rendered output`).
- [x] Aclarar perfiles del Inspector como control de selección única y mostrar descripción seleccionada sin tooltip.
- [x] Corregir terminología del Publish Center, separación label/path de perfil y jerarquía de exportación.
- [x] Hacer onboarding consciente del estado y evitar instruir sobre controles de fondo bloqueados.
- [x] Sustituir terminología merge ambigua y exigir resolución explícita de hunks antes de apply.

## P2 — superficies individuales

- [x] Reorganizar Settings en secciones navegables con modelo de persistencia explícito y menos jerga de implementación.
- [x] Separar gestión de plugins/permisos instalados de browsing del marketplace, manteniendo cuatro tabs principales en una fila.
- [x] Presentar niveles de autorización MCP como estados de seguridad y aclarar scope del vault.
- [x] Convertir el estado saludable de Vault Health en resumen positivo y rebajar acciones de mantenimiento.
- [x] Hacer Note History comparison-first y restore-second, con timestamps coherentes y lecturas de preview fail-closed.
- [x] Empty states positivos y no redundantes en Knowledge Workbench.
- [x] Mejorar dirección del Graph, visibilidad de aristas recíprocas, foco, controles, teclado y uso del canvas.
- [x] Simplificar acciones del rail Git, wording, estrategia pull, confirmaciones y jerarquía de commit.
- [x] Resolver conflictos de forma diff-first, siempre cerrable y segura por defecto.
- [x] Aclarar categorías de command palette, alineación de atajos y acciones de consecuencias.
- [x] Dar una primera acción obvia al Canvas vacío; rebajar export hasta tener contenido y eliminar fuga de CLI de desarrollo.
- [x] Implementar gestión real de shortcuts en lugar de reutilizar Settings.

## P2 — accesibilidad, responsive, temas, localización

- [x] Mantener targets coarse-pointer de 44 px en toda la cascada CSS final.
- [x] Verificar semántica de teclado para Canvas, graph, toolbar menus, filas Git virtualizadas y controles de estado de seguridad.
- [x] Verificar modo oscuro en todos los dialogs/panels revisados, no solo workspace. Cobertura automática: Settings, MCP, Graph, Knowledge Workbench, Note History, Canvas, Plugins, Git/conflicts, Export & publish, Vault Health y onboarding, con assertions explícitas de superficie oscura.
- [x] Completar matriz visual para escalado Windows, nombres largos, datos grandes, loading/error y confirmaciones destructivas. Incluye regresión Windows, device scale 125% y app zoom, anchuras compact/mobile/tablet, vaults virtualizados grandes con nombres largos, skeletons lentos, fallos editor/preview, confirmaciones destructivas, RTL persa y expansión alemana.
- [x] Eliminar colores hard-coded restantes donde se requieren tokens semánticos. El barrido final normalizó chrome, estados, warnings, reader, error overlays y foregrounds de acciones primarias. Los literales restantes son paletas intencionadas, colores de usuario/contenido, export/print, visualización/categorías o fallbacks tras variables semánticas.

## Problemas de corrección y confianza encontrados en el detour

- [x] Eliminar reconstrucción heurística de merge ancestors y fallar cerrado ante bloques incompletos/no resueltos.
- [x] Corregir refresh inicial que leía state React obsoleto inmediatamente después de `setVault`.
- [x] Hacer consentimiento de plugins least-privilege: solo permisos requeridos por defecto, grants aditivos por vault y revoke por vault.
- [x] Serializar mutaciones de config del vault y preservar estado MCP propiedad del runtime durante saves de Settings.
- [x] Enrutar LanguageTool por la ruta de red desktop soportada y mostrar fallos de servicio.
- [x] Renderizar estados extendidos de tareas coherentemente con el parser.
- [x] Desactivar restore de Note History cuando la revisión o comparación actual no pueda leerse.
- [x] Exponer estrategia Git pull de la capa nativa en vez de hard-codear fast-forward.

## Verificación

Cada elemento marcado tiene al menos uno de: prueba unit/component focalizada, assertion E2E, assertion de accesibilidad o contrato visual. Las pruebas de screenshot se están endureciendo para que una feature ausente falle en vez de capturar silenciosamente un fallback.

El último recovery pass eliminó también la segunda autoridad UI `splitPreview`: `chrome.editorSurfaceMode` controla Source/Split/Rendered, presets y toggles pasan por esa autoridad y el inspector recibe el mismo estado efectivo. Los fixtures E2E de chrome usan ahora el envelope de almacenamiento versionado de producción, evitando fallback silencioso a defaults. También se corrigieron accessible names obsoletos y locators demasiado amplios.

El workflow temporal de escritura solo para la rama, usado para aplicar atómicamente la recuperación entre muchos archivos, se eliminó a sí mismo tras el commit correcto; no forma parte de la superficie propuesta de producto/CI.

El PR permanece draft hasta que CI, desktop compile y visual review del head actual estén verdes y cualquier punto restante se implemente o se separe explícitamente como follow-up con evidencia.
