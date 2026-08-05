# Sharing and Sync

Scriptor inventories local agent resources and synchronizes validated skills across supported applications, IDEs, and CLIs from the desktop app.

## Trust model

Discovery and mutation are separate operations. A configuration directory by itself never confirms that an application is installed. Confirmation requires at least one bounded identity signal:

- an executable that resolves to a concrete path, returns a successful bounded version probe, and has a recorded SHA-256 hash;
- a known installed application binary with a recorded hash; or
- an installed editor extension whose exact publisher and extension identifier match its package metadata.

Every discovered resource keeps its physical target, scope, canonical path, manifest path, ownership marker, validation issues, and normalized content fingerprint. Invalid resources remain visible but cannot be selected as synchronization sources.

## Support levels

- **Native:** AgentStack, Claude Code, Codex, and the vendor-neutral Agent Skills directory.
- **Compatible:** targets with documented skill directories, currently Visual Studio Code and Copilot, Windsurf, Zed, Gemini CLI, and OpenCode.
- **Inventory only:** detected products without a sufficiently stable documented write contract. Scriptor shows their evidence but does not mutate their files.

Support level and installation status are independent. A supported target is writable only after its application identity is confirmed, except for the explicitly vendor-neutral `~/.agents/skills` library.

## Plans and execution

Synchronization and deduplication always begin with an immutable plan. A plan:

- is bound to the complete inventory fingerprint;
- includes the expected source and destination fingerprints;
- expires after ten minutes;
- is consumed once;
- collapses multiple selected products that share one physical destination into one operation;
- rejects overlapping destinations before mutation; and
- requires a native one-time authorization scoped to the plan identifier.

Independent destinations may run in parallel with a bounded worker count. Only one plan mutates resources at a time. The frontend receives structured progress and receipts, never raw process stdout or stderr.

## Deduplication

Scriptor distinguishes:

- **Exact mirror:** identical content intentionally installed for different targets or scopes.
- **Redundant:** identical content repeated inside the same target and scope.
- **Diverged:** the same logical identity with different content.

Only redundant exact copies can produce an automated deduplication plan. The copy is moved to Scriptor's recovery quarantine and hash-verified; it is not permanently deleted. Mirrors are retained, and diverged resources require a manual merge decision.

## Recovery

Updates stage and hash the replacement before promotion. Existing content is moved to the recovery quarantine first. If promotion or post-write verification fails, Scriptor attempts to restore the previous content and reports a structured failure receipt.
