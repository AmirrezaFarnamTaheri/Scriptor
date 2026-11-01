# MAT-022 — prevent unrelated CI evidence from passing completeness review

Source issue: #202. Focused PR: branch `fix/mat022-evidence-origin-guard-20261102`.

## Defect and correction

The MAT-022 read-only evidence checker previously accepted any syntactically valid `github.com/<owner>/<repo>/actions/runs/<id>` URL. An unrelated project's CI run could therefore make the Scriptor capability's evidence packet look complete even if no Scriptor test was referenced.

The check now requires a Scriptor repository Actions run URL, an exact 40-hex source SHA and existing passed proof fields. Malformed URL credentials and non-HTTPS links are rejected. This reduces false evidence attribution without adding permission or release authority.

## Reproduction and verification

- Reproduced the defect on the original source with `node --test capability-evidence.test.mjs`: the unrelated-repository regression **failed as expected** (`actual []`, `expected ['tests.positive']`).
- Applied the smallest validator guard and ran the same focused tests: **8/8 passed** in local Node 22, no failures.
- Verified the tested production source's Git blob SHA `6b855109542d656f532030125b31d90b51a53ba0` matches the committed production blob.
- Full exact-head hosted CI, artifact links, installed platforms, manual privacy review and actual source-SHA/run linkage remain **independent pending acceptance**. A syntactically valid repo URL does not prove the run executed or passed, and readiness never means supported status.

This is a MAT-022 validator hardening slice, **not** an issue-level acceptance or support-graduation claim.
