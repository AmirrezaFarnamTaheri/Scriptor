# Estrategia de Pandoc

[English](PANDOC_STRATEGY.md) · [简体中文](PANDOC_STRATEGY.zh-CN.md) · [Русский](PANDOC_STRATEGY.ru.md) · [Deutsch](PANDOC_STRATEGY.de.md) · **Español** · [فارسی](PANDOC_STRATEGY.fa.md)

Scriptor exporta mediante Pandoc con argumentos explícitos y permitidos por una allowlist. La aplicación de escritorio y la CLI comparten la lógica de descubrimiento de `scriptor-export-runner`.

## Orden de resolución

1. **`SCRIPTOR_PANDOC_PATH`** — ruta absoluta a un ejecutable de Pandoc. Se usa cuando TI instala Pandoc fuera de `PATH` o cuando hay varias versiones.
2. **`pandoc` en `PATH`** — opción predeterminada. En Windows la ruta se obtiene con `where pandoc`; en Unix, con `which pandoc`.

Verificar el descubrimiento:

```powershell
pnpm cli -- export-discover
```

## Opciones de instalación

| Enfoque | Estado | Notas |
|---|---|---|
| Pandoc del sistema en `PATH` | **Predeterminado** | Coincide con configuraciones habituales de usuarios avanzados; instalador más pequeño. |
| Sobrescritura `SCRIPTOR_PANDOC_PATH` | **Compatible** | Documentada para despliegues empresariales. |
| Pandoc incluido en el instalador | **Opcional** | `SCRIPTOR_BUNDLED_PANDOC_DIR` + `scripts/release/install-bundled-pandoc.ps1` |

El dry-run de exportación funciona sin Pandoc instalado y solo muestra los argumentos. Las exportaciones reales requieren un binario funcional de Pandoc y los motores específicos del formato, por ejemplo LaTeX para PDF.

## Configuración recomendada

**Windows (winget):**

```powershell
winget install --id JohnMacFarlane.Pandoc
```

**macOS (Homebrew):**

```bash
brew install pandoc
```

**Linux:** paquete de la distribución o archivo oficial de una versión de Pandoc.

## Modos de fallo

| Síntoma | Solución |
|---|---|
| `pandoc was not found on PATH` | Instalar Pandoc o configurar `SCRIPTOR_PANDOC_PATH`. |
| El dry-run funciona, pero la exportación real falla | Faltan filtros o motores de Pandoc para el formato elegido. |
| Se selecciona una versión incorrecta de Pandoc | Configurar `SCRIPTOR_PANDOC_PATH` con el binario deseado. |

## Límite de licencias Pandoc GPL / AGPL

Pandoc se distribuye bajo **GPL-2.0-or-later**. Scriptor se distribuye bajo **AGPL-3.0-or-later**. Las licencias son compatibles para distribución, pero el límite de invocación sigue siendo importante.

### Cómo usa Scriptor Pandoc

Scriptor ejecuta Pandoc como un **proceso externo** mediante `std::process::Command` en `crates/export-runner`. Ningún código fuente de Pandoc se enlaza, ni estática ni dinámicamente, dentro del binario de Scriptor. El código GPL de Pandoc no entra en el espacio de direcciones de Scriptor.

```
┌──────────────┐   subprocess   ┌──────────────┐
│ Scriptor      │ ─────────────→ │ pandoc        │
│ (AGPL-3.0)   │ ←───────────── │ (GPL-2.0+)   │
└──────────────┘   stdout/file  └──────────────┘
```

### Qué implica

| Escenario | Obligación de licencia |
|---|---|
| Scriptor se distribuye sin Pandoc | No existe obligación GPL por Pandoc. El usuario lo instala por separado. |
| Scriptor incluye Pandoc en el instalador | Pandoc sigue siendo una obra separada; el instalador debe cumplir GPL-2.0+ respecto al binario de Pandoc (oferta de código fuente y aviso de licencia). AGPL-3.0+ se aplica solo al código de Scriptor. |
| Scriptor llama a Pandoc en tiempo de ejecución | No surge una obligación de obra combinada; invocar un proceso no es enlazar. |
| Scriptor distribuye filtros de Pandoc | Los filtros que importan módulos de Pandoc son obras derivadas GPL-2.0+. Los filtros de Scriptor que solo se comunican por stdin/stdout son obras separadas. |

### Allowlist de `extra_pandoc_args`

Los `extra_pandoc_args` proporcionados por el usuario pasan por una allowlist en `crates/export-runner/src/allowlist.rs`. Esto evita la inyección arbitraria de argumentos y garantiza que solo flags seguros y documentados lleguen al subproceso de Pandoc. La allowlist es una frontera de seguridad, no un mecanismo de licencias.

### Pandoc incluido (opcional)

Si Scriptor incluye Pandoc en el instalador en el futuro (`SCRIPTOR_BUNDLED_PANDOC_DIR`), el proceso de release debe:

1. distribuir el archivo de licencia propio de Pandoc junto al binario;
2. incluir una oferta escrita del código fuente de Pandoc según GPL-2.0 §6;
3. documentar la versión y licencia de Pandoc en las release notes.

Estas obligaciones se aplican únicamente al binario de Pandoc, no a Scriptor.

## Seguridad

- Los argumentos de exportación se construyen a partir de tipos Rust estructurados, no concatenando strings de shell.
- `extra_pandoc_args` pasa por una allowlist en `export-runner`.
- Si Pandoc se incluye en el futuro, `export-discover` deberá mostrar metadatos de versión fijados para facilitar el diagnóstico de soporte.
