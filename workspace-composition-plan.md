# Workspace composition completion

Continue the accepted review scope through integrated workspace leaves and plugin navigation. Preserve native authority boundaries and unrelated user files.

1. Characterize existing shell, panel, editor-save and plugin registration flows.
2. Implement bounded, runtime-validated per-vault tab/layout persistence, guarded navigation and close, keyboard navigation and narrow/RTL layout.
3. Complete plugin-manager workspace registration, permission-aware navigation and manifest compatibility; use existing typed plugin contracts.
4. Integrate activity navigation and docking without bypassing editor/source/runtime shutdown decisions or re-running side effects during restore.
5. Add failing behavioral coverage, browser evidence for restore/navigation/revocation/dirty drafts and layout, then run source, type, lint and build gates and specialist review.
6. Reconcile historical completion rows and record verification limits in docs/changelog.

Root owns App/shell integration and shared documentation. Separate specialists own layout model/UI and plugin-manager composition. Reviewers assess final integrated behavior. No deployment or live provider write is part of this work.
