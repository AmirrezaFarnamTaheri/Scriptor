# MAT-022 — evidence completeness before capability graduation

Issue: [MAT-022 #202](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/202).

The graduation contract in `docs/CAPABILITY-MATURITY.md` has eight distinct requirements: an owner/support window; stable contract/schema policy; positive, negative, restart, cancellation and recovery tests; native authorization and privacy review; bounded performance; user/operator documentation; verified release inclusion and CI-built runtime/artifact smoke; and changelog evidence.

This source-only slice introduces `assessCapabilityEvidence(packet)` to check a versioned **evidence index**, not to execute a test or grant supported status. The packet names an immutable 40-hex source head and GitHub Actions links for every required case. A missing, failed or differently-versioned test is reported as missing rather than silently accepted. CI artifact/runtime smoke and privacy evidence remain independent requirements from unit tests; no physical installation or manual approval is required.

The output has `evidenceIndexComplete` and `missing`, not `supported`: a complete evidence index is a syntactic preflight, **not** a verification of referenced CI jobs. A separate machine verifier must resolve job identity, source SHA, execution status, assertions, artifact hashes and authorization/privacy proof before capability labels change. Physical installation and human sign-off are no longer required. A syntactically valid URL is **not proof** the job exists or validates a particular test.

## Tests and limitations

Expanded deterministic tests cover complete packets, missing/failing negative/restart/recovery proof, exact-head mismatches, absent privacy/CI artifact-smoke acceptance, unsafe paths and non-GitHub links. A local Node 22 isolated equivalent test run passed **6/6**; committed exact-head source CI is a separate gate. A behavioral RED was not observed before implementation and is not claimed.

The source tool is intentionally not wired to releases, CI promotion, provider credentials or automatic documentation edits. No MAT capability is graduated by this PR. Full MAT-022 requires a policy owner, automated verification of evidence links and exact commit, CI artifact/runtime smoke, deterministic user journeys, security/privacy tests and updated capability documentation; no human approval or real-world installation. Refer to `docs/MAT-AUTOMATED-ACCEPTANCE.md` after the policy change lands.

## Source-bound GitHub Actions metadata inspection (additional verification)

Run the new **read-only** verifier with a concrete schema-v1 capability evidence packet:

    GITHUB_TOKEN=<read-actions-token> node scripts/validation/verify-capability-run-metadata.mjs /path/to/evidence.json

The private token must be provided via a protected environment variable, never committed or printed. The CLI exits 0 only after checking every referenced run against the exact source SHA and the Scriptor repository, requiring a **completed successful run and completed successful explicitly named job step** matching each distinct `caseId`; it retrieves job pages up to a bounded 1,000 jobs. A missing/inaccessible/failed/stale run, missing or skipped step, malformed API payload, or unverifiable extra pagination is a failure, not a success. Exit 1 means the claimed metadata is unverified; exit 2 means the verifier could not be executed.

The core pure verifier (`capability-run-metadata.mjs`) and REST adapter (`capability-run-github.mjs`) have deterministic no-network tests with fabricated/mismatched run and job fixtures. Those tests exercise verifier **behavior**, not live service availability. The step name must actually correspond to an executed assertion; a named success step is not independent proof of what assertions it performed.

**Deliberate hard boundary:** even exit 0 is **only Actions run/step metadata validation**. It does not cryptographically verify package bytes, SBOM, attestation signatures, tested virtual-runtime artifact identity, native consent/permission behavior, or third-party live-provider compatibility. `supportGraduated` and `artifactProvenanceVerified` remain `false`; further automated source-bound artifact/behavior checks must succeed before MAT-022 or any capability is marked accepted/supported. The new helper never updates release labels or permission brokers.
