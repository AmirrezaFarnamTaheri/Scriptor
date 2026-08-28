# Mobile Architecture

**Maturity:** design-only / incubating.  
**Shipping status:** not part of the supported Scriptor 1.0 desktop product.  
**Authority:** [`PRODUCT.md`](../../PRODUCT.md) and [`CAPABILITY-MATURITY.md`](../CAPABILITY-MATURITY.md).

## Purpose

This document records the architectural boundary for future mobile work without implying a shipped Android or iOS application. Scriptor's supported product remains the Tauri desktop application on Windows, macOS, and Linux. Mobile work may prototype portable domain logic and user flows, but it must not silently widen the product-support contract.

## Architectural contract

A future mobile client must preserve the same product invariants as desktop:

1. **Markdown is authoritative.** Notes remain ordinary files. A mobile index is derived and rebuildable.
2. **Portable domain logic stays below platform adapters.** Parsing, task semantics, link resolution, templates, merge logic, and other deterministic policies belong in shared packages/crates when their APIs are platform-neutral.
3. **Native capabilities are explicit adapters.** File picking, background work, notifications, secure storage, share sheets, and platform lifecycle behavior must live behind mobile-specific boundaries rather than leaking into shared domain modules.
4. **No hidden cloud dependency.** A future sync feature is optional and separately threat-modeled; mobile does not change the local-first authority model by default.
5. **Trust boundaries remain fail-closed.** External intents, imported files, plugin/tool execution, and any future remote synchronization require explicit validation and bounded resource use.
6. **Behavioral parity is contract-driven, not UI-copy driven.** Shared fixtures and generated contracts should prove note/task/link semantics across desktop and mobile rather than duplicating implementations.

## Proposed topology

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

The existing `apps/mobile/` material, when present, is therefore exploratory. It must not be consumed by desktop release gates as if it were a production target, and packaging comments must not describe Android/iOS as currently supported release platforms.

## Promotion gates

Mobile can move from **Design-only** to **Experimental** only when all of the following exist:

- a named runtime/toolchain and reproducible build entry point;
- a platform data-authority design that preserves Markdown portability;
- permission, background-execution, and secure-storage threat models;
- contract tests proving shared note/task/link semantics;
- migration/backup/recovery behavior for user-authored files;
- accessibility and lifecycle tests on at least one real device class;
- an explicit support matrix in `PRODUCT.md` and `CAPABILITY-MATURITY.md`.

Promotion to **Production** additionally requires release packaging, signing/trust policy, crash/diagnostic support, upgrade/rollback behavior, and the same release-evidence standards applied to desktop.

## Non-goals for the current release

- no claim of Android or iOS feature parity;
- no mobile installer/package in the desktop release set;
- no mobile-specific compatibility burden on desktop internals;
- no cloud account requirement introduced merely to enable future mobile work.
