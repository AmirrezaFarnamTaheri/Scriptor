# Scriptor documentation

## Authoritative current-state documents

| Document | Purpose |
|---|---|
| [`../README.md`](../README.md) | overview, setup, verification, release posture |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | runtime topology, ownership, trust and failure boundaries |
| [`CAPABILITY-MATURITY.md`](CAPABILITY-MATURITY.md) | shipped, experimental, evaluation, and design-only status |
| [`../PRODUCT.md`](../PRODUCT.md) | user outcomes, promises, exclusions |
| [`../DESIGN.md`](../DESIGN.md) | UI system, responsiveness, accessibility |
| [`../SECURITY.md`](../SECURITY.md) | security boundary and reporting policy |
| [`RELEASE-SECURITY.md`](RELEASE-SECURITY.md) | signing, SBOM, provenance, consumer verification |
| [`ENCRYPTION-THREAT-MODEL.md`](ENCRYPTION-THREAT-MODEL.md) | experimental encryption decision gate |
| [`OPERATIONS.md`](OPERATIONS.md) | tracing, correlation, health and incidents |
| [`FINAL-REMEDIATION-REPORT.md`](FINAL-REMEDIATION-REPORT.md) | current v1 product, schema, and release baseline |
| [`VERIFICATION.md`](VERIFICATION.md) | executed, static, pending, release, and history proof gates |
| [`RELEASE-CHECKLIST.md`](RELEASE-CHECKLIST.md) | production go/no-go checklist |

## User and contributor guides

- [`guides/GETTING_STARTED.md`](guides/GETTING_STARTED.md)
- [`CAPABILITIES.md`](CAPABILITIES.md)
- [`../CONTRIBUTING.md`](../CONTRIBUTING.md)
- [`plugins/AUTHOR_GUIDE.md`](plugins/AUTHOR_GUIDE.md)
- [`contracts/COMMAND_CATALOG.md`](contracts/COMMAND_CATALOG.md)
- [`contracts/CONTRACT_INDEX.md`](contracts/CONTRACT_INDEX.md)
- [`contracts/CONTRACT_GOVERNANCE.md`](contracts/CONTRACT_GOVERNANCE.md)

## Design and validation

- [`design/DESIGN_SYSTEM.md`](design/DESIGN_SYSTEM.md)
- [`design/LAYOUT_BLUEPRINTS.md`](design/LAYOUT_BLUEPRINTS.md)
- [`validation/ACCESSIBILITY_AUDIT.md`](validation/ACCESSIBILITY_AUDIT.md)
- [`validation/FRONTEND_QUALITY.md`](validation/FRONTEND_QUALITY.md)
- [`assets/screenshots/README.md`](assets/screenshots/README.md)

## Architecture records

| File | Scope |
|---|---|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Runtime topology, ownership, trust and failure boundaries |
| [`architecture/c4-container.md`](architecture/c4-container.md) | Container-level runtime diagram (Mermaid) |
| [`architecture/c4-context.md`](architecture/c4-context.md) | Context diagram (Mermaid) |
| [`architecture/IPC_DAEMON.md`](architecture/IPC_DAEMON.md) | Daemon RPC surface, invariants, and validation (pointer to `ARCHITECTURE.md` for topology) |
| [`architecture/PLUGIN_SYSTEM.md`](architecture/PLUGIN_SYSTEM.md) | Plugin manifest, safe mode, marketplace, authoring |
| [`architecture/PERFORMANCE_ARCHITECTURE.md`](architecture/PERFORMANCE_ARCHITECTURE.md) | Optimization layers, owners, and performance budgets |
| [`architecture/TUI_PARITY.md`](architecture/TUI_PARITY.md) | TTY TUI parity model with the desktop surface |

All capability claims in these files must agree with [`CAPABILITY-MATURITY.md`](CAPABILITY-MATURITY.md). A design document is not proof that a capability ships.

## Archived material

Pre-v1 research and superseded design evaluations are preserved under [`_archived/`](_archived/) for historical reference. They are not linked from the main documentation index.

## Release references

- [`release/SIGNING.md`](release/SIGNING.md)
- [`release/PANDOC_STRATEGY.md`](release/PANDOC_STRATEGY.md)
