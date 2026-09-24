# Revisión visual de la interfaz — 2026-09-24

[English](ui-visual-review-2026-09-24.md) · [فارسی](ui-visual-review-2026-09-24.fa.md) · [简体中文](ui-visual-review-2026-09-24.zh-CN.md) · [Русский](ui-visual-review-2026-09-24.ru.md) · [Deutsch](ui-visual-review-2026-09-24.de.md) · **Español**

Esta revisión cubre los primeros planos aportados por el usuario y la galería de capturas de la documentación. La galería muestra estados estáticos de un vault de ejemplo; no demuestra que todos los flujos se hayan probado con un vault real.

La galería actualizada contiene 35 imágenes PNG. Se revisaron todas en hojas de contacto, y las capturas del editor vacío y de tablet también a resolución completa. Los 108 estados visuales pasaron después de los cambios finales, junto con pruebas específicas de geometría en tablet, alternancia de paneles y tarjeta del editor vacío.

## Correcciones incluidas

| Área | Hallazgo y corrección |
| --- | --- |
| Editor vacío | El borde terminaba antes de los botones y el texto inferior. Ahora una sola tarjeta contiene todo el estado vacío y se eliminó el degradado decorativo. Una prueba del navegador comprueba la geometría en escritorio y tablet. |
| Historial y selector de vault | El marco y el desplazamiento interno daban una apariencia de recorte. Se quitó el marco redundante y cada control conserva su propio borde. |
| Acciones de la barra superior | Git y Quick Capture volvían a abrir el panel con cada clic. Ahora el segundo clic lo cierra; los comandos y enlaces directos siguen abriendo explícitamente. |
| Support | El corazón queda visible de forma predeterminada en escritorio. La configuración predeterminada antigua se migra una sola vez y se conservan las personalizaciones. En móvil estrecho, Support sigue disponible desde la paleta de comandos. |
| Ayudas de la barra superior | Las ayudas posicionadas podían salirse de su botón. Los iconos ahora usan títulos nativos y nombres accesibles. |
| Navegación en tablet | Las pestañas del Inspector, la fecha diaria y los modos se recortaban o solapaban. Las pestañas pueden ajustarse, la fecha usa una etiqueta compacta y los modos usan un selector. |

## Revisión detallada de los primeros planos repetidos

1. **Estado vacío:** El defecto principal era que el borde no abarcaba todo el contenido. El mensaje puede ocupar dos líneas al ancho mostrado. Los botones mantienen una jerarquía primaria y secundaria clara. Conviene revisar el contraste del texto pequeño «Local-first…» con zoom del 200 % y en modo oscuro.
2. **Historial:** Atrás y Adelante son controles de navegación; la carpeta abre un vault y el selector cambia entre los vaults recientes. El marco anterior hacía parecer que eran un único campo. También debe verificarse a 320, 375, 768, 1024 y 1440 píxeles.
3. **Origen y vista previa:** La nota mostrada empieza por `[@citekey]---` y luego `_organized: true`. El frontmatter YAML válido debe comenzar con `---` en una línea propia. El renderizador conserva el frontmatter mal formado visible para no ocultar contenido. Además, **Preview**, tanto en el centro como a la derecha de **Split**, es editable y no ejecuta toda la canalización HTML. **Rendered output** en el Inspector usa el renderizador saneado y es la referencia para HTML, citas y Markdown avanzado. La etiqueta «Preview» no explica esta diferencia. Como trabajo posterior, se puede habilitar el renderizado completo con edición directa o renombrar la vista «Visual edit» y enlazarla con «Rendered output».

El primer plano posterior de la tarjeta Outline no muestra títulos recortados, bordes superpuestos ni indicaciones ausentes. En cambio, la imagen de tablet marcada sí mostraba el solapamiento entre historial y selector de modo, ya corregido.

La acción **T Typography** debe conservar el texto: el menú incluye transformaciones tipográficas y limpieza, no solo selección de fuente. «Font» sería impreciso y una «F» sola resultaría ambigua junto a Insert y Tools.

## Observaciones de la galería y seguimiento

| Capturas | Observación | Prioridad |
| --- | --- | --- |
| `workspace-light`, `workspace-dark`, `inspector-preview`, `workspace-rendered`, `editor-preview` | Preview editable y salida renderizada usan rutas distintas y la interfaz no lo explica. | Alta |
| `workspace-tablet` | El recorte de etiquetas está corregido. La zona de estado sigue formando un pie alto y merece una jerarquía más clara. | Media |
| `graph`, `canvas` | Pocos elementos ocupan un lienzo muy amplio. Conviene probar zoom, ajuste y primera acción en la aplicación. | Media |
| `mcp-tools`, `plugin-permissions`, `plugins-installed` | La barra derecha concentra explicaciones y permisos. Revisar foco de teclado, zoom del 200 % y visibilidad de la acción principal. | Media |
| `publish-center`, `settings`, `settings-appearance` | Los formularios largos requieren mucho desplazamiento y repiten campos de ancho completo. | Media |
| `knowledge-workbench`, `note-history`, `vault-health` | Los estados vacíos, comparativos y de salud son legibles. La siguiente acción de Knowledge Workbench podría estar más cerca del título. | Baja |
| `command-palette`, `conflict-resolver` | La selección y los conflictos son visibles. Antes de cambiar el diseño, revisar resolución de conflictos en ancho estrecho, zoom y uso exclusivo del teclado. | Media |

La ejecución visual cubre escritorio estrecho, tablet, móvil, modo oscuro y zoom del 200 %. Aún hace falta una revisión interactiva específica de Preview editable con HTML sin procesar y de paneles acoplados y modales.
