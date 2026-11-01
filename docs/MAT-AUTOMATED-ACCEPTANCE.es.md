[English](MAT-AUTOMATED-ACCEPTANCE.md) · [فارسی](MAT-AUTOMATED-ACCEPTANCE.fa.md) · [简体中文](MAT-AUTOMATED-ACCEPTANCE.zh-CN.md) · [Русский](MAT-AUTOMATED-ACCEPTANCE.ru.md) · [Deutsch](MAT-AUTOMATED-ACCEPTANCE.de.md) · **Español**

# Aceptación automatizada de los MAT (MAT-001–024)

**Vigente desde el 2 de noviembre de 2026.** Se eliminan como criterios obligatorios la instalación física, la aprobación humana, las pruebas con usuarios reales y las cuentas de proveedores en producción. Las evidencias anteriores no se convierten retroactivamente en éxitos.

## Pruebas automatizadas obligatorias

1. **Funcionalidad completa:** cumplir todos los objetivos y casos negativos de cada MAT; modificar una casilla o integrar un PR parcial no basta.
2. **Regresiones reproducibles:** prueba de fallo previo siempre que sea viable, seguida de casos positivos, permisos denegados, bóveda/revisión obsoleta, cancelación, reinicio y recuperación.
3. **CI del commit exacto:** pruebas nativas/Rust, TypeScript, seguridad, contratos, E2E del navegador, accesibilidad, visuales, rendimiento y artefactos en el mismo SHA integrado. Un resultado pendiente o antiguo no cuenta.
4. **Plataformas alojadas:** compilación y ejecución en Windows/macOS/Linux mediante CI o máquinas virtuales; sin instalación manual ni dispositivos físicos. Declarar las plataformas no verificadas.
5. **Flujos automáticos:** escritura/recuperación, bases de datos, captura→cita→publicación, modo sin conexión y errores de proveedores. Verificar teclado, foco, árbol de accesibilidad, RTL, 320–1440 px y zoom del 200 % cuando corresponda. Estas pruebas no certifican la experiencia real de un lector de pantalla.
6. **Proveedores y rendimiento:** simuladores deterministas sin credenciales reales; no afirmar compatibilidad con servicios en vivo. Medir ejecutables y datos reproducibles, variación, umbrales, arranque frío/caliente, hashes, SBOM y procedencia.
7. **Trazabilidad:** registrar comando, SHA, OS/arquitectura, resultado y enlaces de evidencias. Cerrar cada MAT solo con toda la cobertura automatizada aprobada; no se requiere firma humana.

## Seguridad que permanece obligatoria

Retirar la **aprobación humana del proyecto** no elimina el **consentimiento del usuario dentro de la aplicación** para restauraciones destructivas, procesos, escrituras remotas, credenciales o permisos de complementos/MCP. Se mantienen las validaciones nativas, la identidad de bóveda, las revisiones, la protección ante respuestas inciertas y la integridad de las publicaciones. Una simulación no demuestra un proveedor real; cerrar un MAT no convierte automáticamente una función en «Supported» ni publica una versión.

Véase el [contrato normativo en inglés](MAT-AUTOMATED-ACCEPTANCE.md).