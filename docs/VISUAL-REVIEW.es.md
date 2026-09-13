[English](VISUAL-REVIEW.md) · [فارسی](VISUAL-REVIEW.fa.md) · [简体中文](VISUAL-REVIEW.zh-CN.md) · [Русский](VISUAL-REVIEW.ru.md) · [Deutsch](VISUAL-REVIEW.de.md) · **Español**

# Notas de revisión visual

La galería visual de las líneas base de Windows revisadas es el lugar de referencia para todas las capturas tratadas en este documento. La sección de capturas del README, `docs/assets/screenshots/README.md` y los PNG versionados en `docs/assets/screenshots/` son canónicos; esta página registra la **narrativa y la disciplina de revisión**, no una copia duplicada de las imágenes.

## Qué garantiza la suite visual

- La carga diferida de paneles, el desbordamiento de la barra superior, los diseños compactos, el foco de los modales y la limpieza de consola/red se validan en la suite fuente de Playwright y deben volver a ejecutarse sobre el candidato de publicación congelado.
- El modo oscuro y los puntos de ruptura de 1024 / 768 / 375 px forman parte de la matriz; el par de espacios de trabajo del README y las capturas responsivas documentan las líneas base revisadas.
- Los flujos de lector, tareas y kanban se ejercitan mediante la suite funcional de regresión de Playwright y se capturan como evidencia de ejecución cuando sus superficies experimentales están habilitadas.
- Los fallbacks de recuperación, popovers de teclado, gestión de plugins y preparación de la indexación tienen capturas específicas enlazadas desde la galería.

## Disciplina de revisión

- Cualquier cambio de línea base requiere inspeccionar el diff visual y dejar una nota de revisión explícita en el paquete de cambios.
- Las capturas obsoletas solo se sustituyen después de que un revisor inspeccione el diff; los fallos visuales nunca se ocultan aumentando la tolerancia global.
- La suite fuente de Playwright y los PNG versionados deben concordar. Los PNG son artefactos de documentación y no constituyen por sí solos evidencia de publicación. Siguen siendo autoritativos el commit exacto, el navegador, el viewport y el resultado de `pnpm test:visual`.

## Referencias cruzadas

- Sección de capturas del README — recorrido orientado al usuario por el espacio de trabajo y las superficies de escritura, conocimiento, visualización, automatización y operación/publicación.
- `docs/assets/screenshots/README.md` — cada PNG versionado, su tamaño y los documentos que lo referencian.
- `docs/RELEASE-CHECKLIST.md` — comprobaciones visuales de la publicación.
- `docs/VERIFICATION.md` — trazabilidad de la evidencia de verificación visual.
