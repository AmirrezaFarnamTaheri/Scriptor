[English](MOBILE_ARCHITECTURE.md) · [فارسی](MOBILE_ARCHITECTURE.fa.md) · [简体中文](MOBILE_ARCHITECTURE.zh-CN.md) · [Русский](MOBILE_ARCHITECTURE.ru.md) · [Deutsch](MOBILE_ARCHITECTURE.de.md) · **Español**

# Arquitectura móvil

**Madurez:** solo diseño / en incubación.  
**Estado de distribución:** no forma parte del producto de escritorio Scriptor 1.0 soportado.  
**Autoridad:** [`PRODUCT.es.md`](../../PRODUCT.es.md) y [`CAPABILITY-MATURITY.es.md`](../CAPABILITY-MATURITY.es.md).

## Propósito

Este documento define el límite arquitectónico para trabajo móvil futuro sin implicar que exista una aplicación Android o iOS publicada. El producto soportado sigue siendo la aplicación de escritorio Tauri en Windows, macOS y Linux. El trabajo móvil puede prototipar lógica de dominio portable y flujos de usuario, pero no debe ampliar silenciosamente el contrato de soporte.

## Contrato arquitectónico

Un futuro cliente móvil debe conservar las mismas invariantes que el escritorio:

1. **Markdown es autoritativo.** Las notas siguen siendo archivos ordinarios; el índice móvil es derivado y reconstruible.
2. **La lógica portable queda debajo de adaptadores de plataforma.** Parsing, semántica de tareas, resolución de enlaces, templates, merge y políticas deterministas pertenecen a packages/crates compartidos cuando sus APIs son neutrales a la plataforma.
3. **Las capacidades nativas son adaptadores explícitos.** Selección de archivos, trabajo en segundo plano, notificaciones, almacenamiento seguro, share sheets y ciclo de vida de la plataforma viven detrás de límites móviles específicos.
4. **Sin dependencia cloud oculta.** Un futuro sync es opcional y tiene threat model separado; móvil no cambia por defecto el modelo local-first.
5. **Los límites de confianza siguen fail-closed.** Intents externos, archivos importados, ejecución de plugins/tools y futuro sync remoto requieren validación explícita y recursos acotados.
6. **La paridad de comportamiento es contractual, no copia de UI.** Fixtures compartidos y contratos generados deben demostrar semántica de notas/tareas/enlaces entre escritorio y móvil.

## Topología propuesta

```text
mobile UI / navigation
        |
        v
mobile application adapter
        |
        +--> shared TypeScript domain packages
        |
        +--> native mobile capability adapters
                 |-- filesystem / document provider
                 |-- secure settings / credentials
                 |-- notifications / background scheduling
                 `-- optional sync transport (future, separately governed)
```

El material existente en `apps/mobile/`, cuando exista, es exploratorio. Los gates de release de escritorio no deben consumirlo como objetivo de producción y los comentarios de packaging no deben describir Android/iOS como plataformas actualmente soportadas.

## Gates de promoción

Móvil puede pasar de **Design-only** a **Experimental** solo cuando existan:

- runtime/toolchain definido y build reproducible;
- diseño de autoridad de datos que preserve la portabilidad de Markdown;
- threat models de permisos, background y secure storage;
- contract tests de semántica compartida nota/tarea/enlace;
- migración/backup/recovery para archivos del usuario;
- pruebas de accesibilidad y lifecycle en al menos una clase real de dispositivo;
- matriz de soporte explícita en `PRODUCT.md` y `CAPABILITY-MATURITY.md`.

El paso a **Production** exige además packaging, signing/trust policy, soporte de crash/diagnóstico, upgrade/rollback y los mismos estándares de evidencia del escritorio.

## No objetivos de la versión actual

- no se afirma paridad Android/iOS;
- no hay paquete/instalador móvil en el release de escritorio;
- no se introduce carga de compatibilidad móvil en internals de escritorio;
- no se requiere cuenta cloud solo para habilitar trabajo móvil futuro.
