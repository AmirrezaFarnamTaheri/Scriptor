# MAT-022 — Verify downloaded CI artifact archive bytes

Issue: [#202](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/202).

The MAT-022 evidence index and Actions run metadata verifier can establish that a job reports success at the exact source SHA, but **a passing job does not establish integrity of an artifact ZIP**. This independent read-only verifier checks the bytes of one GitHub Actions archive against a submitted SHA-256 digest and GitHub's artifact metadata.

## Input and invocation

Create an evidence file such as `artifact-proof.json`:

```json
{
  "sourceHead": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "runId": 120,
  "artifactId": 130,
  "artifactName": "desktop-smoke",
  "sha256": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
}
```

The values above are **illustrative only**, not evidence of a real Scriptor build. Populate each field from a real completed Scriptor workflow and the SHA-256 digest of its archive. Run:

```sh
GITHUB_TOKEN=<read-actions-token> node scripts/validation/verify-capability-artifact.mjs artifact-proof.json
```

Use an ephemeral token with read-only Actions access, supplied through protected CI environment variables. Do not commit the token, put it in evidence JSON, or paste it into logs. The tool prints only proof identifiers and results. Exit code 0 means `artifactDigestVerified: true`; exit 1 means unverified; exit 2 means the verifier could not run.

## Checks and boundaries

- Exact Scriptor repository, successful completed workflow, 40-character immutable source SHA and canonical run URL.
- Artifact ID, name, non-expired status, exact workflow ID/SHA, canonical API URL and archive download URL, and a GitHub metadata `sha256:` digest matching the submitted digest.
- Actual downloaded ZIP bytes are hashed independently and compared to both digests; exact length must match metadata. Files larger than 128 MiB are rejected.
- The authorized GitHub endpoint issues an HTTP 302 to a signed ZIP URL. Only recognized HTTPS GitHub/Azure artifact storage hosts are followed, without forwarding the API bearer token. Redirect chains, HTTP, unknown hosts and credential-bearing URLs are refused.
- Missing, malformed, stale, failed, cancelled, revoked, rate-limited and truncated responses are unverified, never a success. Deterministic tests use fake API/archive streams and perform no external writes.

An archive hash match **does not establish** that the artifact's executable started successfully, that tested runtime bytes match the archive, or that a job step honestly exercised authorization, privacy, recovery, accessibility, performance, cross-platform behavior or real external providers. It does not attest an SBOM or signature and never changes capability support labels. Automated MAT-022/MAT-024 acceptance still requires separate source-bound runtime/artifact smoke, native permission and fault-injection tests, and applicable platform journeys. No physical installation or human sign-off is required, but native in-product consent remains mandatory.

Related verifier: `scripts/validation/verify-capability-run-metadata.mjs`.
