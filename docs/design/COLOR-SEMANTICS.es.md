[English](COLOR-SEMANTICS.md) · [فارسی](COLOR-SEMANTICS.fa.md) · [简体中文](COLOR-SEMANTICS.zh-CN.md) · [Русский](COLOR-SEMANTICS.ru.md) · [Deutsch](COLOR-SEMANTICS.de.md) · **Español**

# Semántica y propiedad del color

**Estado:** contrato de diseño activo

Scriptor separa los valores de color por responsabilidad para que el estado del producto no quede codificado mediante literales sin propietario.

## 1. Tema y colores semánticos de UI

Los estados interactivos, estado general, selección, foco, advertencias, errores, éxito, bordes y superficies de la aplicación deben consumir propiedades personalizadas CSS con nombre. La capa de compatibilidad actual expone variables como `--primary`, `--danger`, `--success`, `--selected`, `--surface` y `--border`; el sistema escalonado de tokens en `src/styles/tokens/` es propietario de las paletas primitivas y semánticas correspondientes.

El CSS de componentes y el código React no deben crear un nuevo valor hexadecimal para representar un estado de aplicación o interacción. Añada o mapee un token en su lugar.

## 2. Paletas de contenido y visualización

Los datos visuales persistidos o creados por el usuario son distintos del chrome de la aplicación. Rellenos/trazos de bloques Canvas, colores de notas adhesivas, anotaciones, series/carpetas del grafo, definiciones de temas de sintaxis/editor, defaults SVG exportados y paletas de tema seleccionables por el usuario pueden contener colores literales cuando el literal forme parte del formato de contenido o de la propia paleta con nombre. Esos valores no deben reutilizarse como color implícito de estado de la aplicación.

## 3. Fallbacks

Un componente no debe eludir la propiedad de tokens con un fallback semántico literal como `var(--danger, #b42318)`. Los tokens de aplicación obligatorios están definidos por el contrato de tema. Los renderers de contenido sí pueden usar fallbacks literales estables al cargar datos de usuario sin estilo, porque esos valores describen contenido del documento, no estado de UI.

## 4. APIs Canvas

Los atributos de presentación SVG pueden referenciar variables CSS directamente. Las APIs Canvas 2D necesitan colores resueltos, por lo que los colores Canvas con semántica de aplicación se leen desde las propiedades personalizadas computadas del elemento activo. Una paleta de visualización solo puede utilizarse como fallback de renderizado, no como fuente de semántica de estado.
