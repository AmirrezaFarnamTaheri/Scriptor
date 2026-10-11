# Optional workspace shortcuts — 2026-10-08

## User-requested behavior

The previous activity row rendered every first-party and plugin workspace with
44px buttons, permanently occupying a full row. The supplied light/dark images
show the resulting density above the note tabs and formatting toolbar.

The replacement starts with Writing, Source file and Note preview. Each shortcut
can be added/removed, pinned directly to the row or placed under More workspaces,
reordered, renamed, and assigned a bounded width and text size. The entire row
can be hidden. The command palette's Customize workspace shortcuts command
remains available to restore a hidden row; workspace command routes keep their
original identities and authorization checks. Compact mouse controls retain
larger touch targets on coarse pointers. App zoom no longer overrides the user's
explicit row visibility.

## Ownership and persistence

Preferences live in `scriptor:workspace-shortcuts:v1`, separate from per-vault
workspace references and source drafts. Values are validated and bounded;
labels remain plain text. Newly registered integrations stay opt-in, while
temporarily unavailable plugin settings are retained for later restoration.
Saving updates the UI only after storage succeeds. Storage denial leaves the
draft open with an actionable error. Cancel and Escape discard the draft.
Other windows observe saved settings through storage events.

## Verification and limits

Model cases cover defaults, opt-in additions, order/pinning/size restoration,
plain-text labels, malformed/versioned/oversized storage, entry deduplication,
and dimension bounds, including the 128-item cap and nonfinite numbers. Browser
cases cover compact defaults, renamed/resized shortcuts, removal/reinclusion,
unpinning, keyboard overflow launches and reload, hiding/restoring through the
palette, focus after hiding/reordering, narrow restored 200% zoom, cancellation
and a real storage failure. Existing
German/Persian route tests explicitly pin integration shortcuts to retain
coverage of localized labels and preserved drafts.

The hosted workflow for `7676ea60510b26d65efcc92de298bb5393b31a73` passed
all 134 cases, including these shortcut regressions. Its five paired shortcut
states were individually inspected. That inspection identified low-contrast
storage-error text; theme ink and a red severity marker now have an additional
rendered contrast assertion requiring subsequent hosted verification.
No local application, browser, build, lint, typecheck, installation or test
execution was used. Screenshot references are refreshed only through the
designated hosted workflow after individual capture inspection.
