[English](BOUNDARY_OUTCOMES.md) · [فارسی](BOUNDARY_OUTCOMES.fa.md) · [简体中文](BOUNDARY_OUTCOMES.zh-CN.md) · [Русский](BOUNDARY_OUTCOMES.ru.md) · [Deutsch](BOUNDARY_OUTCOMES.de.md) · **Español**

# Contrato de resultados en límites

Los adaptadores de límite de Scriptor usan una única álgebra de seis estados. El objetivo es impedir que un valor opcional ausente, estado persistido malformado, resultado parcial, fallo de ejecución y recuperación correcta colapsen en el mismo valor vacío/por defecto.

| Estado | Contrato | ¿Default permitido? |
| --- | --- | --- |
| `value` | Resultado autoritativo de la operación. | No aplicable. |
| `absent-optional` | El estado opcional está realmente ausente. El llamador puede mapearlo a un default o vacío explícitamente documentado. | **Sí, solo aquí.** |
| `invalid` | Input, configuración, estado serializado o datos persistidos están malformados. Devuelva código y mensaje tipados. | No. |
| `degraded` | Hay estado parcial útil, pero warnings identifican partes omitidas/no disponibles. | Sin default silencioso; los warnings viajan con el valor. |
| `failed` | La operación falló. Devuelva código, mensaje y si retry/recovery es razonable. | No. |
| `recovered` | La operación tuvo éxito mediante un recovery explícito. Conserve un recibo de recuperación. | No borrar silenciosamente el evento de recovery. |

`contracts/operations.json` asigna estados permitidos a cada comando Tauri, método RPC del daemon, tool MCP y comando CLI catalogado. Metadatos TypeScript/Rust generados y checks de paridad hacen que las adiciones fallen de forma cerrada hasta declarar su semántica de límite.

## Reglas de adaptadores

1. No use `unwrap_or_default`, `.ok()`, `filter_map(Result::ok)` ni equivalentes en límites autoritativos salvo que el contrato fuente represente explícitamente `absent-optional`.
2. Configuración inválida del vault es `invalid`, no ausencia.
3. Errores al decodificar filas son `failed` o `degraded` con warnings, nunca se omiten silenciosamente.
4. Fallos de procesos/IPC usan códigos estructurados y recoverability, no strings sin tipo.
5. Recovery tras reparación atomic-write/journal es `recovered`; emita o conserve un recibo cuando el límite lo exponga.
