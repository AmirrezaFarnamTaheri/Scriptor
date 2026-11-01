# Automated MAT acceptance (MAT-001–024)

**Effective 2026-11-02.** This replaces earlier project-completion requirements for real-world installation, human approval/sign-off, real-user studies and live third-party accounts. Past evidence reports are historical and are not retroactive completion claims. The full MAT issue scope and substantive safety requirements remain unchanged.

## No manual or physical acceptance gate

MAT completion does **not** require a person to install the application, run a task study, approve a capability label, inspect a physical device, provide provider credentials, or attest that they used screen-reader software. Release operators and reviewers are not mandatory MAT approvers.

## Automated definition of done

1. **Actual implementation:** all objective and regression cases of the specific MAT workstream are implemented, including failures, vault ownership, cancellation, restart and recovery where applicable. Merely editing checklists, introducing fixtures or merging a partial PR is not completion.
2. **Focused behavioral proof:** new logic has failing-first tests where practical; tests run against real production helpers/native seams and independently check assertions. A mock is evidence of the simulated interface only.
3. **Integrated exact-head CI:** the full applicable test suite succeeds on the same integrated source SHA: Rust/Clippy/native contracts, TypeScript, lint, security, browser E2E, accessibility and visual comparisons, processes, artifacts and performance. A queued, failing, skipped-required or older SHA is not a pass.
4. **Hosted platforms:** use GitHub-hosted Windows/macOS/Linux runners and isolated virtual runners/CI-built artifacts for cross-platform compile and executable smoke tests. No physical installation is required. Unavailable platforms are declared as unsupported rather than silently certified.
5. **Automated task and accessibility journeys:** prove writing/recovery, Database Studio, capture→citation→publication, permission denial, offline/expired-provider and process interruption as relevant. Run keyboard/focus and accessible-name/tree tests, light/dark/RTL, 320/375/768/1024/1440-pixel viewports, 200%-equivalent zoom and deterministic screenshot checks as applicable. Automated accessibility-tree checks do not certify a real user's screen-reader experience.
6. **Provider safety:** use deterministic contract/sandbox/fixture tests for third-party provider state and authorization. No live account is required for MAT closure; **do not** claim real-service compatibility based solely on mocked integrations.
7. **Source-bound evidence:** record commit SHA, command, runner OS/architecture, inputs, exit code, failure/negative cases and check/report URLs. All declared tests must be executable, falsifiable and relevant to that workstream. A citation to another repository or an unverified test name does not establish a pass.
8. **Benchmarks and release artifacts:** where in scope, measure actual compiled product paths on reproducible 100/1k/5k/25k fixtures with cold/warm methodology, finite distributions and variance/threshold gates. Build/dissect package artifacts in CI and validate hashes, SBOM, provenance, startup and failure behavior. No manual installation or human artifact approval is required.
9. **Machine-checkable closure:** close a MAT only after its full objective and applicable rows above pass at the integrated commit. Add a compact issue-level evidence matrix and links. **No independent human sign-off is a completion prerequisite.**

## Safety and release boundaries that remain mandatory

Removing human approval **from project acceptance criteria** does **not** remove in-product user consent or authorization for destructive restore, external execution, network writes, scoped provider access, plugin/MCP grants or publication. Native authorization, vault identity, content revision, no silent overwrite, indeterminate-effect handling, privacy boundaries and immutable artifact provenance remain hard gates. Tests must exercise refusal and cancellation.

A MAT can be accepted separately from shipping a public release. Release publication itself still requires source-bound CI, immutable tags, checksums/SBOM, trust records and configured distribution/signing safeguards. Do not use automated MAT acceptance to bypass release integrity or pretend that a live integration, human usability session or release occurred.

## Status labels

- **Implementation partial:** some functionality or regression cases missing.
- **Automated verification pending:** implementation exists, but an applicable exact-head gate has not passed.
- **MAT accepted:** all objective-level automated acceptance cases are evidenced on an integrated SHA.
- **Supported product capability:** additionally complies with the capability ledger's release inclusion, security, documentation and tested compatibility contract. A MAT closure does not automatically graduate other capabilities.
