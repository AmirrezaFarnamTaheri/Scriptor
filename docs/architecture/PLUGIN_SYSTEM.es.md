# Diseño del sistema de plugins

[English](PLUGIN_SYSTEM.md) · [简体中文](PLUGIN_SYSTEM.zh-CN.md) · [Русский](PLUGIN_SYSTEM.ru.md) · [Deutsch](PLUGIN_SYSTEM.de.md) · **Español** · [فارسی](PLUGIN_SYSTEM.fa.md)

![Marketplace de plugins y plugins instalados](../assets/screenshots/plugins.png)

## Objetivos

- Permitir que Scriptor crezca sin volver poroso el núcleo de la aplicación.
- Mantener los archivos y las escrituras del vault protegidos por command contracts.
- Permitir que extensiones first-party y del marketplace incluido añadan commands, comportamiento del renderer, perfiles de exportación, herramientas MCP, widgets del inspector, comprobaciones de salud del vault, herramientas de canvas, blocks y packs de templates.
- Hacer que cada permiso sea visible y revocable.

## No objetivos

- En la primera versión no hay acceso directo del plugin al filesystem.
- No hay daemons en segundo plano gestionados por plugins.
- No hay herramientas MCP de escritura sin review.

## Modelo Runtime de Plugins

```text
Plugin manifest
  -> permission review
  -> activation policy
  -> contribution registry
  -> command bus / renderer / export / MCP slots
  -> audit events
```

Los plugins aportan comportamiento mediante slots:

| Slot | Capacidad | Permiso mínimo |
|---|---|---|
| Command | Command palette y acción de automatización. | `read` |
| Renderer extension | Transformación de la vista previa Markdown. | `read` |
| Export profile | Nuevo destino o template de exportación. | `system` |
| MCP tool | Interfaz AI/tooling. | `read` |
| Inspector widget | Widget note/vault del panel derecho. | `read` |
| Vault health check | Regla de diagnóstico. | `read` |
| Canvas tool | Acción de toolbar del canvas infinito. | `read` |
| Canvas block | Renderer de block registrado para modo canvas. | `read` |
| Template pack | Layouts iniciales de documento o canvas. | `read` |

## Modelo de permisos

| Permiso | Significado |
|---|---|
| `read` | Puede consultar command contracts aprobados. |
| `write-approved` | Puede proponer escrituras que requieren confirmación. |
| `system` | Puede usar cache/jobs derivados sin modificar archivos canónicos. |
| `dangerous` | Requiere advertencia explícita al instalar y confirmación en tiempo de ejecución. |
| `network` | Bloqueado por defecto; se permite mediante allowlist de host. |
| `secrets` | Acceso solo mediante handles de keychain con nombre. |
| `external-process` | Deshabilitado hasta que exista una política de sandbox para plugins. |

## Candidatos first-party

| Plugin | Valor | Slots |
|---|---|---|
| `scriptor-citation-tools` | CSL, bibliografía y health checks de citas ausentes. | inspector widget, health check, export profile |
| `scriptor-graph-lens` | Filtros avanzados de graph e informes de centralidad de notas. | inspector widget, command |
| `scriptor.publish-pack` | Templates de publicación y perfiles de exportación. | export profile, renderer extension |
| `scriptor-vault-lint` | Reglas para enlaces rotos, frontmatter no válido y notas obsoletas. | health check, command |
| `scriptor-mcp-research` | Herramientas read-only de asistente de investigación. | MCP tool, command |
| `scriptor.canvas-kit` | Sticky notes, formas, conectores y templates de tableros de investigación. | canvas tool, canvas block, template pack |

## Controles de seguridad

- Los manifests se validan contra schema antes de cargar.
- Los cambios de permisos requieren confirmación del usuario.
- Los commands de plugins pasan por el mismo command bus que UI y CLI.
- Los widgets reciben datos acotados, nunca handles directos del vault.
- Las extensiones del renderer reciben inputs saneados.
- Un fallo de plugin lo deshabilita sin bloquear la shell de la aplicación.
- Safe mode arranca con todos los plugins deshabilitados.

## Capacidades entregadas

| Capacidad | Ubicación |
|---|---|
| Manifest schema | `@scriptor/core/contracts/plugin` |
| Contribution registry + safe mode | `packages/plugin-api` |
| Catálogo marketplace incluido | `packages/plugin-api/catalog.json`, `src/marketplace.ts` |
| Remote catalog merge | `loadMarketplaceCatalog` (`VITE_SCRIPTOR_PLUGIN_MARKETPLACE_URL`) |
| First-party plugins | `scriptor-vault-lint`, `scriptor.canvas-kit`, `scriptor.publish-pack` |
| Plugin panel UI | `src/components/PluginPanel.tsx` |
| MCP read-only plugin slot | `packages/mcp` |
