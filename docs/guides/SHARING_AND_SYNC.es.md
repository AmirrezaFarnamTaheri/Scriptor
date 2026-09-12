[English](SHARING_AND_SYNC.md) · [فارسی](SHARING_AND_SYNC.fa.md) · [简体中文](SHARING_AND_SYNC.zh-CN.md) · [Русский](SHARING_AND_SYNC.ru.md) · [Deutsch](SHARING_AND_SYNC.de.md) · **Español**

# Compartir y sincronizar

Scriptor inventaría recursos locales de agentes y sincroniza skills validados entre aplicaciones, IDE y CLI compatibles desde la aplicación de escritorio.

## Modelo de confianza

El descubrimiento y la mutación son operaciones separadas. La existencia de un directorio de configuración nunca confirma por sí sola que una aplicación esté instalada. La confirmación requiere al menos una señal de identidad acotada:

- un ejecutable que resuelva a una ruta concreta, supere una consulta de versión acotada y tenga un hash SHA-256 registrado;
- un binario conocido de una aplicación instalada con hash registrado; o
- una extensión de editor instalada cuyo publisher e identificador exactos coincidan con sus metadatos de paquete.

Cada recurso descubierto conserva destino físico, alcance, ruta canónica, ruta del manifest, marcador de propiedad, problemas de validación y fingerprint normalizado del contenido. Los recursos inválidos siguen visibles pero no pueden seleccionarse como fuentes de sincronización.

## Niveles de soporte

- **Native:** AgentStack, Claude Code, Codex y el directorio neutral de proveedor Agent Skills.
- **Compatible:** objetivos con directorios de skills documentados; actualmente Visual Studio Code y Copilot, Windsurf, Zed, Gemini CLI y OpenCode.
- **Inventory only:** productos detectados sin un contrato de escritura documentado suficientemente estable. Scriptor muestra su evidencia pero no modifica sus archivos.

El nivel de soporte y el estado de instalación son independientes. Un objetivo soportado solo es escribible después de confirmar la identidad de su aplicación, salvo la biblioteca expresamente neutral `~/.agents/skills`.

## Planes y ejecución

La sincronización y la deduplicación siempre comienzan con un plan inmutable. Un plan:

- queda vinculado al fingerprint completo del inventario;
- incluye fingerprints esperados de origen y destino;
- expira tras la vida acotada por `PLAN_TTL_MS`;
- se consume una sola vez;
- colapsa productos seleccionados que comparten destino físico en una sola operación;
- rechaza destinos solapados antes de mutar; y
- exige autorización nativa de un solo uso limitada al identificador del plan.

Destinos independientes pueden ejecutarse en paralelo con un número acotado de workers. Solo un plan modifica recursos a la vez. El frontend recibe progreso estructurado y recibos, nunca stdout/stderr crudo de procesos.

## Deduplicación

Scriptor distingue:

- **Exact mirror:** contenido idéntico instalado intencionadamente para distintos destinos o scopes.
- **Redundant:** contenido idéntico repetido dentro del mismo destino y scope.
- **Diverged:** misma identidad lógica con contenido diferente.

Solo copias exactas redundantes pueden producir un plan automático de deduplicación. La copia se mueve a la cuarentena de recuperación de Scriptor y se verifica por hash; no se elimina permanentemente. Los mirrors se conservan y los recursos divergidos requieren una decisión manual de merge.

## Recuperación

Las actualizaciones preparan y hashean el reemplazo antes de promocionarlo. El contenido existente se mueve primero a cuarentena. Si falla la promoción o la verificación posterior a la escritura, Scriptor intenta restaurar el contenido anterior e informa un recibo estructurado de fallo.
