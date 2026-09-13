[English](RUSTSEC-EXCEPTIONS.md) · [فارسی](RUSTSEC-EXCEPTIONS.fa.md) · [简体中文](RUSTSEC-EXCEPTIONS.zh-CN.md) · [Русский](RUSTSEC-EXCEPTIONS.ru.md) · [Deutsch](RUSTSEC-EXCEPTIONS.de.md) · **Español**

# Registro de excepciones de advisories RustSec

Este registro es la autoridad sobre cada advisory ignorado temporalmente por `cargo-deny`. Ignorar no significa descartar: documenta una restricción de dependencia revisada y alcanzable, con responsable, fecha de nueva revisión y condición concreta de salida. Las vulnerabilidades actualizables siguen bloqueadas por CI.

**Responsable:** mantenedores de release y seguridad de Scriptor  
**Cadencia:** mensual y antes de cada tag de producción  
**Última revisión completa:** 2026-09-03  
**Próxima revisión completa:** 2026-10-01

### Evidencia de revisión — 2026-09-03

- Los advisories ignorados de GTK3/Tauri, `proc-macro-error`, `atomic-polyfill`, `paste` y `rust-unic` siguen siendo **INFO / unmaintained** en RustSec y no tienen versión corregida. Los paquetes bloqueados siguen presentes porque el grafo soportado de Tauri/Linux o el grafo transitivo del producto no dispone de un reemplazo mantenido compatible en este checkout.
- `RUSTSEC-2025-0057` (`fxhash`) se eliminó del registro y de `deny.toml`: `fxhash` ya no está en `Cargo.lock`; conservar la excepción ocultaría una futura reintroducción en vez de documentar la alcanzabilidad actual.
- La revisión no suprime vulnerabilidades publicadas después. `cargo deny` sigue siendo la autoridad de producción para advisories fuera de esta lista exacta; el próximo entorno capaz de publicar debe ejecutarlo contra la base RustSec actual antes del tag.

### Seguimiento de auditoría de integración — 2026-09-05

Una base RustSec recién descargada no reportó advisories de clase vulnerabilidad, sí 18 paquetes unmaintained y advisories informativos de unsoundness para `glib` y dos versiones de `lru`. La dependencia TUI pasó de `lru` 0.18.1 a 0.18.2 corregida. Tantivy 0.26.1 sigue resolviendo `lru` 0.16.4 y no apareció sustituto dentro de su rango compatible. El stack Linux de Tauri sigue resolviendo `glib` 0.18.5, afectado por RUSTSEC-2024-0429. Estos dos hallazgos de unsoundness **no** se añaden a la lista de ignores. Siguen siendo trabajo upstream y deben evaluarse antes de producción. La auditoría deshabilitó la consulta de versiones yanked, por lo que no demuestra que el lockfile esté libre de releases retirados.

| Advisory | Familia | Alcance | Responsable | Upstream | Revisar antes de | Condición de salida |
|---|---|---|---|---|---|---|
| RUSTSEC-2024-0370 | Stack GTK/Tauri Linux | Packaging/runtime desktop Linux | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0370.html | 2026-10-01 | Quitar cuando Tauri/WebKitGTK deje de resolver el crate unmaintained afectado |
| RUSTSEC-2024-0411 | Stack GTK/Tauri Linux | Packaging/runtime desktop Linux | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0411.html | 2026-10-01 | Quitar cuando el stack soportado tenga reemplazo mantenido |
| RUSTSEC-2024-0412 | Stack GTK/Tauri Linux | Packaging/runtime desktop Linux | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0412.html | 2026-10-01 | Quitar cuando el stack soportado tenga reemplazo mantenido |
| RUSTSEC-2024-0413 | Stack GTK/Tauri Linux | Packaging/runtime desktop Linux | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0413.html | 2026-10-01 | Quitar cuando el stack soportado tenga reemplazo mantenido |
| RUSTSEC-2024-0414 | Stack GTK/Tauri Linux | Packaging/runtime desktop Linux | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0414.html | 2026-10-01 | Quitar cuando el stack soportado tenga reemplazo mantenido |
| RUSTSEC-2024-0415 | Stack GTK/Tauri Linux | Packaging/runtime desktop Linux | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0415.html | 2026-10-01 | Quitar cuando el stack soportado tenga reemplazo mantenido |
| RUSTSEC-2024-0416 | Stack GTK/Tauri Linux | Packaging/runtime desktop Linux | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0416.html | 2026-10-01 | Quitar cuando el stack soportado tenga reemplazo mantenido |
| RUSTSEC-2024-0417 | Stack GTK/Tauri Linux | Packaging/runtime desktop Linux | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0417.html | 2026-10-01 | Quitar cuando el stack soportado tenga reemplazo mantenido |
| RUSTSEC-2024-0418 | Stack GTK/Tauri Linux | Packaging/runtime desktop Linux | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0418.html | 2026-10-01 | Quitar cuando el stack soportado tenga reemplazo mantenido |
| RUSTSEC-2024-0419 | Stack GTK/Tauri Linux | Packaging/runtime desktop Linux | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0419.html | 2026-10-01 | Quitar cuando el stack soportado tenga reemplazo mantenido |
| RUSTSEC-2024-0420 | Stack GTK/Tauri Linux | Packaging/runtime desktop Linux | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0420.html | 2026-10-01 | Quitar cuando el stack soportado tenga reemplazo mantenido |
| RUSTSEC-2023-0089 | Dependencia transitiva | Grafo del producto; sin upgrade compatible seguro registrado | Release/Security | https://rustsec.org/advisories/RUSTSEC-2023-0089.html | 2026-10-01 | Quitar al existir parent corregido o sustituir la dependencia padre |
| RUSTSEC-2024-0436 | Dependencia transitiva | Grafo del producto; sin upgrade compatible seguro registrado | Release/Security | https://rustsec.org/advisories/RUSTSEC-2024-0436.html | 2026-10-01 | Quitar al existir parent corregido o sustituir la dependencia padre |
| RUSTSEC-2025-0075 | `rust-unic` vía Tauri `urlpattern` | Parsing de patrones URL desktop | Release/Security | https://rustsec.org/advisories/RUSTSEC-2025-0075.html | 2026-10-01 | Quitar cuando Tauri sustituya la familia `rust-unic` unmaintained |
| RUSTSEC-2025-0080 | `rust-unic` vía Tauri `urlpattern` | Parsing de patrones URL desktop | Release/Security | https://rustsec.org/advisories/RUSTSEC-2025-0080.html | 2026-10-01 | Quitar cuando Tauri sustituya la familia `rust-unic` unmaintained |
| RUSTSEC-2025-0081 | `rust-unic` vía Tauri `urlpattern` | Parsing de patrones URL desktop | Release/Security | https://rustsec.org/advisories/RUSTSEC-2025-0081.html | 2026-10-01 | Quitar cuando Tauri sustituya la familia `rust-unic` unmaintained |
| RUSTSEC-2025-0098 | `rust-unic` vía Tauri `urlpattern` | Parsing de patrones URL desktop | Release/Security | https://rustsec.org/advisories/RUSTSEC-2025-0098.html | 2026-10-01 | Quitar cuando Tauri sustituya la familia `rust-unic` unmaintained |
| RUSTSEC-2025-0100 | `rust-unic` vía Tauri `urlpattern` | Parsing de patrones URL desktop | Release/Security | https://rustsec.org/advisories/RUSTSEC-2025-0100.html | 2026-10-01 | Quitar cuando Tauri sustituya la familia `rust-unic` unmaintained |

## Procedimiento de revisión

1. Ejecute `cargo deny check` y `cargo tree -i <crate>` sobre el grafo bloqueado.
2. Confirme si el advisory sigue siendo solo unmaintained o se convirtió en vulnerabilidad explotable.
3. Registre la superficie Scriptor alcanzable y el parent directo que impide retirarlo.
4. Elimine el ignore en cuanto exista una ruta compatible mantenida.
5. Trate una fecha `Review by` vencida como bloqueador de producción.
