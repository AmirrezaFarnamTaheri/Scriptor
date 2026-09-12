# Sistema de diseño

[English](DESIGN.md) · [فارسی](DESIGN.fa.md) · [简体中文](DESIGN.zh-CN.md) · [Русский](DESIGN.ru.md) · [Deutsch](DESIGN.de.md) · **Español**

Scriptor es una interfaz para **trabajar**: los usuarios la abren para escribir, navegar, inspeccionar, comparar y publicar. La expresión visual está al servicio de esas tareas; nunca compite con ellas.

## Dirección

- Precisa, serena, luminosa y técnica, sin imitar un IDE.
- Superficies neutras en tonos carbón/pizarra con un único acento semántico contenido.
- La información densa se separa mediante jerarquía, ritmo y divisores, no mediante tarjetas anidadas.
- Sans serif del sistema para la interfaz y monoespaciada del sistema para código y números; sin fuentes remotas.

## Diseño

En escritorio se utilizan cuatro regiones funcionales:

1. barra superior de comandos;
2. rail de vault/navegación;
3. espacio de trabajo de editor/vista previa;
4. inspector contextual y superficies de estado.

En anchuras reducidas, las regiones secundarias se pliegan dentro de la navegación del workspace móvil. Los cambios del workspace deben comprobarse a `320`, `375`, `768`, `1024` y `1440` píxeles, además de al 200 % de zoom. Ningún control puede depender únicamente de hover.

## Directivas anti-slop

- Sin degradados púrpura/índigo típicos de IA por defecto.
- Sin tipografía de marketing sobredimensionada en superficies operativas del workspace.
- Sin glassmorphism decorativo ni resplandor ambiental; los efectos de cristal basados en tokens se reservan para chrome funcional.
- Sin emojis como iconos estructurales de interfaz; use el conjunto de iconos Lucide establecido.
- Sin transformaciones de escala en hover que desplacen el layout.
- Sin puntuaciones de rendimiento, certificados de finalización ni afirmaciones de verificación inventadas sin evidencia capturada.

## Tokens y personalización

Los tokens autoritativos se encuentran en `src/index.css` y `src/styles/`. Los componentes nuevos deben usar variables semánticas para superficies, texto, bordes, foco, peligro, advertencia, éxito, espaciado, radios y movimiento. Los colores y sombras arbitrarios requieren una excepción documentada.

| Rol del token | Variable de runtime | Propósito / alcance |
|---|---|---|
| Acento principal | `--primary` | Botones de acción primaria, indicadores de pestaña activa, badges clave |
| Ámbar secundario | `--amber` | Advertencias, badges de estado intermedio, destacados secundarios |
| Fondo principal | `--bg` | Fondo raíz del canvas de la aplicación |
| Superficie secundaria | `--surface` | Paneles, barras laterales y tarjetas de diálogos modales |
| Superficie elevada | `--surface-raised` | Estados hover, tarjetas elevadas y elementos de dropdown |
| Texto principal | `--ink` / `--ink-strong` | Texto de cuerpo y encabezados de alto contraste |
| Resaltado de borde | `--border` | Bordes sutiles de paneles y aristas de cristal |
| Anillo de foco | `--focus-ring` | Contorno de foco por teclado |
| Fuente de interfaz | `--font-sans` | Selección de familia tipográfica de UI (`system`, `inter`, `sf-pro`, `avenir-next`, `outfit`, `jetbrains-mono`, `georgia`) |
| Desenfoque de cristal | `--glass-blur` | Intensidad del filtro de fondo (`none`, `subtle`, `glass`, `heavy`) |

### Catálogo de esquemas de color y Custom Theme Builder

Scriptor incluye **18 esquemas de color integrados y ajustados** en tres categorías (`dark`, `light`, `contrast`):
- **Oscuros:** `Dark Midnight`, `Catppuccin Mocha`, `Dracula`, `Nord Frost`, `Tokyo Night`, `Solarized Dark`, `Gruvbox Dark`, `Emerald Forest`, `Cyberpunk Neon`, `Monokai Pro`, `Rosé Pine`, `Synthwave 84`, `One Dark Pro`, `Vitesse Dark`.
- **Claros:** `Light Modern`, `Sepia Paper`.
- **Alto contraste:** `High Contrast`, `OLED True Black`.

Los usuarios también pueden abrir el **Custom Theme Builder** para crear, editar, previsualizar en vivo y eliminar temas personalizados, almacenados dinámicamente en `scriptor:custom-themes`.

## Contrato de interacción

Toda superficie asíncrona debe representar únicamente estados que su propietario pueda determinar. Cuando corresponda, debe proporcionar:

- carga o progreso;
- un estado vacío útil;
- un estado de error accionable;
- confirmación visible de las mutaciones;
- cancelación para trabajos prolongados.

Las operaciones de alto riesgo muestran su alcance y consecuencias mediante una confirmación nativa. Los controles deshabilitados explican el motivo. Los controles destructivos no son la acción predeterminada.

## Base de accesibilidad

Objetivo: WCAG 2.2 AA.

- HTML semántico antes que ARIA;
- tratamiento visible de `:focus-visible` en todos los elementos interactivos;
- orden lógico de tabulación y ausencia de trampas de teclado;
- los diálogos modales usan etiquetas/descripciones, foco inicial, foco contenido, manejo de Escape, bloqueo de scroll y restauración del foco;
- las pestañas admiten flechas, Home, End y `tabIndex` itinerante;
- el estado no se comunica solo mediante color;
- el movimiento respeta `prefers-reduced-motion`;
- los controles orientados a interacción táctil miden al menos 44×44 píxeles CSS;
- el texto del editor y de la UI sigue siendo legible al 200 % de zoom;
- los tokens de texto terciario mantienen contraste WCAG AA sobre sus superficies principales;
- el editor sigue el tema claro/oscuro de la aplicación hasta que el usuario lo sobrescribe explícitamente.

## Movimiento

El movimiento solo comunica cambios de estado. Las transiciones predeterminadas duran entre 120 y 220 ms y usan opacidad o transformaciones que no alteran la semántica del bloque contenedor. Nunca se anima de forma continua una anchura o altura crítica para el layout. El modo de movimiento reducido elimina transiciones no esenciales y smooth scrolling.

## Arquitectura de componentes

- los datos y la orquestación viven en hooks o controladores de dominio;
- los componentes de presentación reciben props tipadas;
- los overlays compartidos usan la primitiva unificada de diálogo/panel;
- los componentes de más de 200 líneas son candidatos a descomposición;
- los packages exponen comportamiento únicamente mediante entry points declarados;
- los estados de carga, vacío, error y éxito permanecen con el propietario capaz de determinarlos de forma veraz.

## Resultados de la auditoría anti-slop

A fecha de 2026-08-09:
- **Emojis sin procesar:** 0 instancias en archivos TSX de producción (100 % iconos SVG de Lucide).
- **`transition: all` sin controlar:** 0 instancias en 433 archivos CSS y TSX.
- **Casts explícitos a `any` en UI:** 0 instancias en componentes TSX de producción.
- **Verificación de contratos:** 43 suites de pruebas unitarias y validación superan el 100 % en `pnpm check:source`.

## Verificación visual

Los proyectos de Playwright cubren temas claro/oscuro, breakpoints de escritorio/móvil, superficies modales, editor/vista previa, knowledge workbench, ajustes, grafo y estados principales de los workflows. El release candidate congelado exige además revisión manual al 200 % de zoom, con lector de pantalla y en la shell nativa hasta que dichas comprobaciones estén automatizadas de forma fiable. Los umbrales de snapshots no deben ocultar desplazamientos de página completa. Consulte [`docs/validation/FRONTEND_QUALITY.es.md`](docs/validation/FRONTEND_QUALITY.es.md).
