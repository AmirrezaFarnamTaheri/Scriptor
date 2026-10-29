# MAT-005/MAT-009 — Database Studio result-scope guard

## Problem
Database Studio's view builder and selector can change the filter without clearing the previous view's rows, totals or edit callbacks. A late view query could repopulate old results or authorize an edit from the previous view.

## Tests
Test-only commit `02692a0` adds two real-component cases to `scripts/validation/database-studio-coordinated-edit.test.mjs`: stale rows/columns/edits after a view change, and an old in-flight list settling after a new filter. Hosted RED was not observed on the intermediate commit when this fix was authored.

## Implementation
- Separate view revision from native operation generation.
- Hide output immediately if loaded vault/revision does not match the current view.
- Clear rows and columns when changing view; invalidate pending queries.
- Recheck the view revision before coordinated native metadata edits and before publishing an edited note.
- Preserve existing coordinator, native authorization, hash precondition, 200-candidate/32-MiB bounds.

## Pending
Exact-head source, frontend/browser/Windows, visual and docs gates; installed-client vault switch, slow queries and dirty-editor workflows. This does not implement MAT-009 native pagination/complete aggregation or MAT-010 typed schema migration/batch edits.
