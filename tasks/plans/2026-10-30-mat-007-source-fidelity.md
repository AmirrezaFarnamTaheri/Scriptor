# MAT-007 — Source-fidelity comparator and shared Markdown corpus (initial slice)

This is one reviewable step toward [MAT-007](https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/187), **not** acceptance of the full editor/renderer/export parity matrix.

## Observed defect

The existing `packages/editor/src/roundtrip.ts` normalization stripped all end-of-line spaces and final newlines, so `roundTripEqual` incorrectly reported equality after deleting Markdown hard breaks (two trailing spaces), opaque fenced-code whitespace, terminal newlines, or an authored CRLF convention.

## Failing-first evidence

In a Node 22 reproduction using the exact old `roundtrip.ts`, **5 of 5** new source-fidelity regressions failed. With the proposed comparator fix, the same five tests passed locally. The tests are integrated into `pnpm check:editor` through `packages/editor/src/validate-runner.ts`.

## Scoped change

- `roundTripEqual` now verifies exact source bytes instead of treating semantic Markdown differences as equal.
- `normalizeMarkdown` still canonicalizes CRLF for non-authoritative semantic comparisons, but no longer removes meaningful trailing whitespace or final newlines.
- The reusable `packages/test-fixtures/markdown/roundtrip/semantic-rich.md` corpus includes frontmatter, a hard break, wikilinks/embeds, citations, nested tasks, tables, math, a diagram, an opaque fence, and raw HTML.

## Verification still required

Run the exact-head editor validation lane, source tests, TypeScript/lint, Browser E2E and other applicable CI. The remaining MAT-007 acceptance work must exercise the **actual writable preview, editor modes, inspector, native reload, and each supported export adapter** with this corpus; compare Markdown/semantic structure, not only HTML output. Deliberate malformed syntax, rendering failures, unsafe HTML sanitization and adjacent-block mutation require their own regressions. Keep issue #187 open until those proofs exist.
