# Complete review feature implementation

User scope confirmed on 2026-09-30: include all proposed features as well as remaining existing-product fixes. Earlier false current-state claims remain false; implement actual additions without deleting working first-party interfaces or lowering their trust boundaries.

## Delivery contract

Markdown files stay authoritative. New operations validate payloads and permissions at the native boundary. Remote operations require explicit in-product consent; credentials remain in the keychain. All external processes use the process broker. Conflicts preserve both sides; stale previews cannot apply. Experiments remain labeled until native and release evidence supports graduation. The user subsequently authorized committing changes and opening a pull request; draft PR #151 contains the earlier verified snapshot. Live deployment and remote product resource mutations remain outside this implementation request.

## Work inventory and acceptance

| Work | Acceptance | Initial status |
|---|---|---|
| Long note identities | Distinguishing filename suffix and folder visible in narrow rails; full accessible path retained | Pending |
| Citations | Narrative and grouped citations render through existing CSL worker; missing source survives; code/links excluded | Implemented; expanded browser verification pending |
| Localized help | Bundled guide bodies available in supported UI locales with preserved commands and safety meaning | Pending |
| Plugin workspace host | Runtime-validated declarative landing contract, capability gate, bounded state, deep-link routing and accessible local host; no arbitrary privileged HTML | Implemented; plugin-manager registration/composition verification pending |
| Reference desk | Abstract/source metadata, paper-to-note workflow, orphan citations and Zotero read-only import with explicit consent | Pending |
| Asset deck | Vault-confined asset browsing, usage metadata, reader split and annotation-to-linked-note creation | Pending |
| Revision analytics | Real history scrubbing, current/revision comparison, explicit stale-checked restore and measured activity heatmap | Pending |
| Diagram studio | Source editing, rendering errors, bounded pan/zoom, links to notes and explicit save | Pending |
| Capture reviewer | Fetch/extract preview before save, editable metadata/content, destination choice and safe highlight references | Pending |
| Planner | Week time grid, task/event mapping, explicit bidirectional sync with conflict and cancellation states | Pending |
| Semantic inspector | Config/model/index state, opt-in reindex, measured similarity visualization and no fabricated clusters | Implemented; 23 embeddings and 68 daemon tests pass; integrated browser verification pending |
| Database studio | Filter builder, table/list/gallery, validated frontmatter cell updates, bounded aggregate/formula operations | Pending |
| Runtime console | Authorized broker sessions, bounded output/cancel, environment review and plot assets; persistent kernels only with process ownership | Pending |
| Publishing studio | Eligibility toggles, local preview and logs; explicit configured deployment/domain adapters | Pending |
| Drive collaboration | OAuth transport, scoped remote mapping, bounded change polling, optimistic revisions and recoverable three-way conflicts; optional loss-aware Docs translation | Pending |
| Mobile | In-process kernel adapter, mobile storage/scope lifecycle, working build configuration and mobile verification where SDK available | Kernel, frontend and Android ARM64 debug APK implemented/verified; device, iOS and release checks remain |
| Canvas semantic relations | Explicit note endpoint semantics, bounded extraction, separate provenance, deletion/rebuild correctness and DQL/graph visibility | Implemented; focused native/browser tests pass; cross-cutting gates pending |
| Alternative export | Opt-in brokered Typst profile plus an in-process Rust PDF backend suitable for mobile/sandboxed hosts | Brokered profile and real compiler artifact verified; in-process backend remains pending |
| Native verification | Product/engine Rust tests, full clippy, daemon/MCP/process/backup stress and package integrity checks; disclose unavailable credentials/platforms | Pending |

## Coordination

Root owns composition (`src/App.tsx`, shell orchestration), contracts, shared translations, top-level docs/changelog, collaboration/mobile integrations and final verification. Specialists own scoped new modules and existing subsystem files assigned in their task messages. They report integration requirements rather than racing on shared composition. The architecture remains the existing Rust/Tauri/React workspace.

Work is staged: characterize existing seams; implement tested vertical workflows; compose and exercise each surface; run cross-cutting gates; update the assessment and evidence. Placeholder interfaces and future-design documents are not completion evidence.

The [2026-10-01 complete reread](docs/validation/REVIEW-REREAD-2026-10-01.md) expands the remaining acceptance checklist, including health repair cards, broader media previews, original-source capture preview, workspace docking, vocabulary evolution, persistent runtimes, Drive polling/Docs translation and in-process PDF export. These remain in the accepted scope.

The [2026-10-02 checkpoint](docs/validation/REVIEW-CHECKPOINT-2026-10-02.md) records completed Database/Reference/Capture workflows, raster/audio previews, Help localization, deployment snapshots and verification. The initial-status table above is historical; the checkpoint and reread acceptance gaps govern current remaining work. Health repair helpers alone do not complete repair workflows.

## Additional scope confirmed on 2026-10-02

- Google Docs as a Markdown sync host alongside Drive: immutable encoded revision records preserve authored Markdown bytes, with integrity checks, mapped folders, bounded consented polling and reviewed conflict resolution. Optional rich Docs translation remains a separate lossy workflow. Media attachments require their own transport and must not be implied by Markdown record synchronization.
- Overleaf synchronization through a supported authenticated transport, reviewed pull/push operations, recoverable conflicts, and explicit project mapping. The local boilerplate contains Overleaf implementations and must be reassessed before selecting an adapter. Provider availability and live-account verification are disclosed separately from implementation.
- Standalone LaTeX and source-code editing (including Python), Markdown with executable code chunks, and Markdown with local media. Preserve the native file extension and bytes; source files must not be rewritten as Markdown notes or indexed as prose. Use file-specific editor modes and keep all execution explicitly authorized.
