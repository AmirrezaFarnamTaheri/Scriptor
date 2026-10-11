# Final polish and forensic review

The outcome is a corrected, tested implementation with an evidence ledger for the
final pass requested on 2026-10-04. The starting revision is
`19ff396a27d0c7e289ed82ca3d0b942f23f17c19`.

## Scope and invariants

- Inventory the tracked corpus, separate generated and fixture data, and trace
  each major product boundary against current source and prior review evidence.
- Preserve authoritative file contents, unsaved work, originating-vault scope,
  explicit permissions, bounded work, and recoverable mutation.
- Reproduce material defects, implement the smallest correct fix, and add durable
  tests before claiming resolution. Cosmetic fixes use direct visual evidence.
- Review native/core, shared TypeScript/mobile/automation, and React workflows in
  separate ownership lanes; integrate changes and verify cross-layer behavior.
- Preserve the existing user-owned schema edit, `.gortex/`, original reviews and
  supplied boilerplate archive. No live service writes or release publication.

## Execution and evidence

1. Read both supplied protocols completely and refresh product/design contracts.
2. Inventory modules, fixtures, documents, release assets and verification gates.
3. Audit native authorization/data/process/recovery boundaries; shared runtime
   validation and transports; renderer state/lifecycle and user workflows.
4. Audit visual behavior, keyboard interaction, responsive layout, zoom, focus,
   accessible names, themes, localization and reduced motion.
5. Reproduce and fix confirmed defects; challenge unsupported prior claims.
6. Run full test/build verification exclusively on GitHub Actions workers.
   Do not start local full suites or builds. Review and implementation continue
   locally; record remote results before claiming verification.
7. Record source/runtime evidence and limits in the final review artifact and
   `docs/VERIFICATION.md`; commit and update the existing draft PR.

Generic protocol prescriptions such as universal interface parity, lock-free
rewrites or new daemon splits apply only when project requirements and evidence
support them. They do not override explicit experimental capability boundaries.

## Completion standard

The user's 2026-10-04 resource restriction supersedes the earlier local
verification plan: never run full tests or builds on this computer. Delegate
those workloads to GitHub Actions. The local browser verification process was
stopped when this restriction was received; interrupted runs are not passes.

Every discovered defect has a disposition, test/evidence and residual limits.
Coverage distinguishes semantic inspection, static scanning, runtime execution,
inventory-only material and justified exclusions. Passing browser fixtures is
not live-provider, packaged-device, screen-reader or release certification.

## Cross-product follow-up

The renewed final review starts from
`15b94b13870ca7d8ece9e600c1801cbf12b5768b`. Trace current native mutation and
authorization boundaries, renderer lifecycle/data-loss risks, and responsive
visual/interaction contracts in specialist lanes. The parent owns integration,
hosted verification failures, release transports, and the combined evidence
ledger. Preserve user inputs and the worker-only restriction. Confirmed defects
receive a repair and a meaningful regression where practical; do not equate
inventory or static coverage with runtime certification.
