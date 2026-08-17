# V1 product baseline

**Product version:** `1.0.0`
**Contract:** one current source, API, and persisted-state schema.

## Product boundary

Scriptor v1 has one authority for each durable concern:

- the vault owns content, capability decisions, audit records, and recovery data;
- native adapters validate and authorize every filesystem, process, IPC, and capability-sensitive operation;
- the renderer owns only presentation state, request lifecycle, and cached read models;
- package contracts define the exact renderer, desktop, daemon, CLI, MCP, and plugin interfaces.

Persisted browser data must use the current validated envelope. Invalid or obsolete values are quarantined; they are never interpreted as live state. Plugin state is vault-backed. Canvas storage uses canonical identifiers and rejects noncanonical files.

## V1 release requirements

A release is eligible only when the exact source head has passed the applicable locked dependency, Rust, browser, accessibility, desktop, artifact, and recovery checks in [`VERIFICATION.md`](VERIFICATION.md). Release artifacts must be built from the immutable `v1.0.0` tag, bound to checksums, SBOMs, receipts, and GitHub attestations as described in [`RELEASE-SECURITY.md`](RELEASE-SECURITY.md).

Experimental capabilities remain excluded from supported-product claims until they satisfy the graduation requirements in [`CAPABILITY-MATURITY.md`](CAPABILITY-MATURITY.md).

## Repository hygiene

The shipped tree contains current product and operator documentation only. Superseded plans, review packets, forensic snapshots, and historical changelog entries are deliberately not part of the v1 contract.
