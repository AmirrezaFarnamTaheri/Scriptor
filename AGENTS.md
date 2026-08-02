# Repository agent instructions

- Preserve unrelated user changes and do not commit/push/release without explicit authorization.
- Read `PRODUCT.md`, `DESIGN.md`, `docs/ARCHITECTURE.md`, and `docs/CAPABILITY-MATURITY.md` before changing behavior or claims.
- Packages are deep modules; read `packages/README.md` before adding or importing one.
- New behavior requires a failing behavioral test first when practical.
- New native commands require authorization classification and runtime validation.
- External processes must use `crates/system-bridge/src/process.rs`.
- Update docs, changelog, source contracts, and verification evidence with the implementation.
