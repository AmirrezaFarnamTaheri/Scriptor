# MAT-016 — Google Tasks duplicate-ownership preflight

**PR:** #230, based on main. **Backlog:** #196. This slice is independent of the current import, Canvas, Git and recovery PRs.

## Source-grounded safety contract
A source identity may authorize at most one provider record. Two Google Tasks with the same vault/task marker must not be treated as a match and a removed task; two local tasks with the same stable ID must not generate two provider creates. On ambiguity, stop the whole batch before the native/provider mutation API. Never silently assign ownership, complete another record, or assume rollback.

## Evidence and status
- [x] Test-only `12334132dad4e71fc7d54e09543be263f344443a` adds two real-hook regressions in `scripts/validation/calendar-vault-scope.test.mjs`.
- [x] Hosted failing-first source suite: [CI #40883180912](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/40883180912), 685 tests, 683 passed and exactly these two ownership tests failed. Each observed a provider mutation batch where none was safe.
- [x] Implement the minimum duplicate local-ID and current-vault remote-marker checks before the native Google Tasks batch, reusing the existing error and single-flight handling.
- [ ] Exact-head hosted source/TypeScript/Rust/Windows/browser/visual/docs verification.
- [ ] Installed desktop and real-provider duplicate-task, permission-denial, refresh and reconnect verification.
- [x] Extend fail-closed preflight for multiple source claims per remote record, repeated remote IDs, malformed current-vault markers and duplicate migratable legacy markers. Four additional hook tests were added on test-only `dd5601a8`; hosted RED was not observed before implementation.
- [ ] Further MAT-016 duplicate-title reorders, source-note movement, account changes and live provider collision/reconciliation acceptance.

## Boundaries
No new provider state manager, native command, permission broker, schema, dependency or record mutation is introduced. The visible error tells the user to review duplicates rather than deleting them. Provider task list consistency beyond the last successful snapshot and ambiguous post-write transport outcomes are not inferred.
