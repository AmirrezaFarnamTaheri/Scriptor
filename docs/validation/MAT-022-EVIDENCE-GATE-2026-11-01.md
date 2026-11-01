# MAT-022 — evidence completeness before capability graduation

Issue: [MAT-022 #202](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/202).

The graduation contract in `docs/CAPABILITY-MATURITY.md` has eight distinct requirements: an owner/support window; stable contract/schema policy; positive, negative, restart, cancellation and recovery tests; native authorization and privacy review; bounded performance; user/operator documentation; verified release inclusion and installed artifacts; and changelog evidence.

This source-only slice introduces `assessCapabilityEvidence(packet)` to check a versioned **evidence index**, not to execute a test or grant supported status. The packet names an immutable 40-hex source head and GitHub Actions links for every required case. A missing, failed or differently-versioned test is reported as missing rather than silently accepted. Packaged installation and privacy evidence are separate from successful unit tests.

The output only has `readyForHumanReview` and `missing`: it never contains `supported` or mutates `docs/CAPABILITY-MATURITY.md`. A complete evidence index can still contain incorrect or fabricated links; a human reviewer must inspect the underlying job, installed device, consent, artifacts and provenance before changing capability labels. A syntactically valid URL is **not proof** the job exists or validates a particular test.

## Tests and limitations

Six deterministic tests cover complete packets, missing/failing negative/restart/recovery proof, exact-head mismatches, absent privacy/installed acceptance, unsafe paths and non-GitHub links. A local Node 22 isolated equivalent test run passed **6/6**; committed exact-head source CI is a separate gate. A behavioral RED was not observed before implementation and is not claimed.

The source tool is intentionally not wired to releases, CI promotion, provider credentials or automatic documentation edits. No MAT capability is graduated by this PR. Full MAT-022 requires a policy owner, validated evidence links, legitimate installed and user journeys, explicit human sign-off and updated multi-language capability documentation.
