# MAT-013 — reviewed local BibTeX key import (bounded slice)

**Tracking issue:** https://github.com/AmirrezaFarnamTaheri/Scriptor/issues/193  
**Branch:** `feat/mat013-reviewed-bibtex-key-diff-20261101`  
**Scope:** a read-only key-diff gate before the **existing local .bib create-only import** in Reference Desk.

## User-visible behavior

Importing a local `.bib` file now inspects up to 8 MiB and 10,000 citation entries. The review shows how many keys are new and how many collide with **currently indexed** bibliography entries. It lists up to ten collision keys with their known source paths. A duplicate key *within* the incoming file, malformed/truncated entry container, unsupported key syntax, NUL or invalid UTF-16 blocks the Save button with an explanation.

A user must resolve a collision in their source file rather than silently renaming keys that may already occur in a manuscript. The UI rechecks current indexed rows at the button action. The actual source file is still written through Scriptor's existing native **create-only** vault writer, which denies replacement of an existing destination path. This change adds no new file-writing authority, network traffic, watcher or background job.

The local scanner inspects structure and keys. It is **not** a full BibTeX grammar or CSL validator and does not assert that every field is valid. Indexed bibliography data can be stale; a concurrent edit or a missing indexed source is not detected by this slice. Native create-only admission protects destination files, not cross-file citation-key uniqueness. The preview therefore must not be advertised as an authoritative current-vault diff or a complete MAT-013 refresh.

## Verification and test-first evidence

- `src/lib/reviewBibtexImport.test.ts` added first with local observed RED: 5 of 5 cases failed against a stub implementation. Following implementation, local Node 22 `node --experimental-strip-types --test` returned **5/5 passing**, and TypeScript strict `--noEmit` completed successfully.
- Tested exact Git blob IDs: test `fff4a3c22c3fb702f3a536072f2b3b4503b38c07`; implementation `59db01808f43cb461178799bab4e8d1b9d435535`.
- `e2e/research-workspaces.spec.ts` adds a browser regression for an indexed collision, a truncated import, a new key and zero native writes before approval.
- Repository CI and real installed-app/browser behavior remain **pending exact-head verification**, independent of local pure-unit tests.

## Explicitly outstanding

MAT-013 also requires detection of changed selected BibTeX/Better BibTeX sources, stable source identity and refresh timestamps, read-only entry-by-entry differences, authority and revision checks before **reviewed** replacement/merge, account/source switching, watcher debouncing, offline Zotero, truncated exporter output, rollback, accessible and localized review, full installed-platform verification, and guaranteed unchanged manuscript citations. None is certified by this small import-safety change.

Keep MAT-013 open and the PR in draft until the broader criteria are implemented and verified.
