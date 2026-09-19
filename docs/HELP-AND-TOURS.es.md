# Ayuda contextual, preguntas y recorridos

[English](HELP-AND-TOURS.md) · [فارسی](HELP-AND-TOURS.fa.md) · [简体中文](HELP-AND-TOURS.zh-CN.md) · [Русский](HELP-AND-TOURS.ru.md) · [Deutsch](HELP-AND-TOURS.de.md) · **Español**

## Contrato del producto

La ayuda funciona sin conexión y en modo de solo lectura. Explica la aplicación actual; no es un chat de IA, un operador automático ni un sistema de autorización. Ningún paso ejecuta comandos, envía correo, habilita plugins, ejecuta código, publica, restaura o elimina datos. Completar un recorrido significa haberlo leído, no que una operación haya finalizado correctamente.

El registro autorizado está en `src/lib/help/catalog.ts`. Cada entrada incluye ruta de acceso, requisitos, consecuencias, madurez, archivo responsable, selectores contextuales, pasos, respuestas, temas relacionados y política de presentación. También cubre widgets y paneles acoplados. Las funciones no disponibles siguen siendo consultables con sus requisitos, sin habilitarse automáticamente.

## Cuándo se muestra la orientación

En el primer inicio solo aparece una introducción breve al espacio de trabajo. Se puede omitir y repetir desde la ayuda o desde la opción de introducción existente.

La primera utilización de funciones complejas puede mostrar una invitación pequeña, no modal y descartable: personalización de herramientas, citas, Workbench, grafo, Canvas, tareas, Kanban, lector, plugins, Google, Gmail, IA, MCP, sincronización de recursos, Portal, captura rápida, apariencia, paneles acoplados, historial, copias e importación. Solo hay una invitación visible; cada función se ofrece una vez por perfil local de ayuda. Nunca toma el foco ni inicia por sí sola un recorrido completo.

Las restauraciones, conflictos, permisos, ejecución de código, cambios de nombre, aplicación de propuestas y ajustes avanzados se explican únicamente cuando el usuario lo solicita. Los widgets habituales de escritura y navegación tampoco abren recorridos automáticos. Todos los recorridos completos son de inicio manual.

Se pueden desactivar las invitaciones sin desactivar la ayuda. Cerrar conserva la posición; solo Finalizar marca la lectura como completa. Reiniciar afecta al recorrido seleccionado. Restablecer el progreso requiere confirmación y no modifica notas, cuentas, credenciales ni preferencias generales.

## Interacción y accesibilidad

F1 resuelve primero la superficie enfocada, después la última utilizada y, como alternativa, la descripción general. Los botones de interrogación abren el tema correspondiente. El diálogo de ayuda tiene título accesible, cierre, orden de tabulación y prioridad de Escape propios; conserva el panel inferior y devuelve el foco al control de origen cuando todavía existe.

Mostrar este control cierra la ayuda y revela o enfoca exclusivamente un elemento ya presente. No lo pulsa, no habilita capacidades y no abre funciones ocultas. Si falta el objetivo, explica la ruta y los requisitos sin avanzar silenciosamente. El contenido es texto, no HTML ejecutable. No se recopilan ni envían consultas, notas, mensajes, rutas o credenciales.

Los controles están disponibles en inglés, alemán y persa. El corpus detallado está redactado actualmente en inglés y lleva `lang=en` y `dir=ltr`. Un aviso localizado hace explícita esta limitación. Las traducciones futuras deben conservar identificadores estables y equivalencia del contenido.

## Persistencia y validación

El progreso usa la clave local, limitada y versionada `scriptor:help-guides:v1`. Los identificadores desconocidos y pasos inválidos se descartan o normalizan. Si el almacenamiento está bloqueado, lleno o dañado, la ayuda sigue funcionando en memoria con una advertencia visible. El progreso no equivale a consentimiento ni a finalización de una tarea real.

`src/lib/help/help.test.ts` verifica catálogo, políticas, búsqueda, progreso, fallos de almacenamiento, recarga y validación de solicitudes. Las pruebas de navegador deben cubrir invocación contextual sobre otro diálogo, F1 durante la escritura, Escape y retorno del foco, invitaciones, repetición, objetivos ausentes, tamaños, zoom, RTL y ausencia de operaciones automáticas. Toda nueva superficie debe registrar una guía o enlazar explícitamente una existente y comprobar sus selectores.

## Punto de control anterior

Antes de esta ampliación, PR #135 en `c6a714bff2c085d330144ad98dc6530fea1ab29e` superó CI, Desktop compile, Visual review, Documentation localization y Starlight lock template. Esto registra el estado anterior, no resultados aún no ejecutados para la nueva ayuda.
