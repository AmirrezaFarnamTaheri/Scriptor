# Ayuda contextual, preguntas y recorridos

[English](HELP-AND-TOURS.md) · [فارسی](HELP-AND-TOURS.fa.md) · [简体中文](HELP-AND-TOURS.zh-CN.md) · [Русский](HELP-AND-TOURS.ru.md) · [Deutsch](HELP-AND-TOURS.de.md) · **Español**

## Contrato del producto

La ayuda funciona sin conexión y en modo de solo lectura. Explica la aplicación actual; no es un chat de IA, un operador automático ni un sistema de autorización. Ningún paso ejecuta comandos, envía correo, habilita plugins, ejecuta código, publica, restaura o elimina datos. Completar un recorrido significa haberlo leído, no que una operación haya finalizado correctamente.

El registro autorizado está en `src/lib/help/catalog.ts`. Cada entrada incluye ruta de acceso, requisitos, consecuencias, madurez, archivo responsable, selectores contextuales, pasos, respuestas, temas relacionados y política de presentación. También cubre widgets y paneles acoplados. Las funciones no disponibles siguen siendo consultables con sus requisitos, sin habilitarse automáticamente.

## Cuándo se muestra la orientación

- **Primer inicio de la aplicación:** solo aparece la introducción breve al espacio de trabajo. Se puede omitir y repetir desde la ruta de introducción existente o desde Ayuda.
- **Ayuda global:** hay un único acceso visible **Ayuda y guías** en la barra superior, también disponible desde la paleta de comandos. Los paneles, tarjetas, docks, barras del editor y cabeceras modales no reciben iconos de ayuda inyectados.
- **Ayuda contextual:** **F1** resuelve primero la función enfocada, después la última utilizada y finalmente la vista general. **Mayús+F1** inicia o reanuda directamente el recorrido contextual.
- **Orientación al primer uso:** las superficies complejas, opcionales, experimentales o de mayor consecuencia muestran una sola invitación no modal después del onboarding: **Abrir guía**, **Iniciar recorrido** o **Ahora no**. Nunca inicia el recorrido automáticamente.
- **Solo manual:** los controles simples y los flujos urgentes/de recuperación permanecen accesibles únicamente mediante F1, búsqueda de Ayuda o la paleta de comandos.
- **Recorridos detallados:** todos siguen requiriendo una acción explícita del usuario; la invitación de primer uso no concede permisos ni ejecuta operaciones.

Cerrar un recorrido conserva la posición. Solo Finalizar lo marca como leído. Reiniciar afecta únicamente al recorrido seleccionado. Restablecer el progreso requiere confirmación y no modifica notas, cuentas, credenciales ni preferencias generales.

## Interacción y accesibilidad

F1 elige la superficie enfocada, después la última utilizada y finalmente la descripción general. El único control de Ayuda de la barra superior abre la guía del espacio de trabajo y el centro de ayuda buscable. No se insertan controles adicionales en cabeceras o controles pertenecientes a cada función.

“Mostrar este control” cierra Ayuda y revela o enfoca únicamente un elemento que ya existe. No hace clic, no abre funciones ocultas ni concede permisos. Si falta el objetivo, se muestran la ruta y los requisitos sin avanzar el progreso en silencio. El contenido es texto, no HTML ejecutable. No se recopilan ni envían búsquedas, notas, mensajes, rutas ni credenciales.

El diálogo de Ayuda mantiene su título accesible, cierre, orden de Tab y prioridad de Escape sin desmontar la función subyacente. Al cerrar, el foco vuelve al control de origen cuando sigue disponible.

Los controles admiten inglés, alemán y persa. El corpus detallado sigue redactado en inglés y está marcado explícitamente con `lang=en` y `dir=ltr`; un aviso localizado explica esta limitación.

## Persistencia y validación

El progreso usa la clave local acotada y versionada `scriptor:help-guides:v1`. Los identificadores desconocidos y pasos inválidos se rechazan o normalizan. Si el almacenamiento está bloqueado, lleno o dañado, la ayuda continúa en memoria con un aviso visible.

`src/lib/help/help.test.ts` cubre integridad del catálogo, política bajo demanda, búsqueda, progreso, fallos de almacenamiento, recarga y validación de solicitudes. `e2e/help-scope-regressions.spec.ts` verifica que no se inyecten controles de Ayuda en la interfaz, que exista un único acceso global, que F1 resuelva la función correcta y que el recorrido del espacio de trabajo pueda revelar su objetivo.

Las nuevas superficies deben registrar una guía o enlazar explícitamente una existente y conservar selectores verificables, sin añadir otro botón permanente de Ayuda.

## Punto de control anterior

Antes de esta ampliación, PR #135 en `c6a714bff2c085d330144ad98dc6530fea1ab29e` superó CI, Desktop compile, Visual review, Documentation localization y Starlight lock template. Esto registra el estado anterior, no resultados aún no ejecutados para la nueva ayuda.
