# Complete review feature implementation

User scope confirmed on 2026-09-30: include all proposed features as well as remaining existing-product fixes. Earlier false current-state claims remain false; implement actual additions without deleting working first-party interfaces or lowering their trust boundaries.

## Delivery contract

Markdown files stay authoritative. New operations validate payloads and permissions at the native boundary. Remote operations require explicit in-product consent; credentials remain in the keychain. All external processes use the process broker. Conflicts preserve both sides; stale previews cannot apply. Experiments remain labeled until native and release evidence supports graduation. No commit, push, deployment, or remote resource mutation is authorized by this local implementation task.

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
| Mobile | In-process kernel adapter, mobile storage/scope lifecycle, working build configuration and mobile verification where SDK available | Pending |
| Canvas semantic relations | Explicit note endpoint semantics, bounded extraction, separate provenance, deletion/rebuild correctness and DQL/graph visibility | Implemented; focused native/browser tests pass; cross-cutting gates pending |
| Alternative export | Opt-in Typst backend through broker with bounded work and capability preflight | Implemented; 57 export-runner tests pass; installed compiler artifact verification pending |
| Native verification | Product/engine Rust tests, full clippy, daemon/MCP/process/backup stress and package integrity checks; disclose unavailable credentials/platforms | Pending |

## Coordination

Root owns composition (`src/App.tsx`, shell orchestration), contracts, shared translations, top-level docs/changelog, collaboration/mobile integrations and final verification. Specialists own scoped new modules and existing subsystem files assigned in their task messages. They report integration requirements rather than racing on shared composition. The architecture remains the existing Rust/Tauri/React workspace.

Work is staged: characterize existing seams; implement tested vertical workflows; compose and exercise each surface; run cross-cutting gates; update the assessment and evidence. Placeholder interfaces and future-design documents are not completion evidence.
