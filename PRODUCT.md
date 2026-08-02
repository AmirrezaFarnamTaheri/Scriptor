# Product

**Scriptor** · *The instrument for serious writing* · version source: [`VERSION`](VERSION)

## Users and job

Scriptor serves writers, researchers, students, technical authors, and knowledge workers who maintain long-lived Markdown vaults. They hire Scriptor to capture material, connect evidence, draft and revise long-form work, manage citations, inspect knowledge quality, publish reproducibly, and automate bounded tasks without surrendering file ownership.

## Product promise

1. Markdown files remain portable and authoritative.
2. A user can understand what will be read, written, sent, executed, or deleted before a high-risk action occurs.
3. Index, graph, Git, export, and backup state are observable and recoverable.
4. The writing workspace remains calm and readable under dense research work.
5. Experimental capabilities are labeled and never represented as shipped guarantees.

## Supported surfaces

| Surface | Maturity |
|---|---|
| Web development shell | Supported for development and visual tests |
| Tauri desktop (Windows, macOS, Linux) | Primary product surface |
| Headless daemon and CLI/TUI | Supported operational surfaces |
| MCP stdio integration | Supported with scoped tools and durable audit records |
| Plugin catalog | Manifest-first, restricted, experimental platform |
| Mobile, encrypted vaults, embeddings, Tantivy, WASM host | Experimental or design-only |

The authoritative matrix is [`docs/CAPABILITY-MATURITY.md`](docs/CAPABILITY-MATURITY.md).

## Success measures

- no silent loss or cross-vault mutation;
- bounded memory and latency as vault size grows;
- reproducible, signed, attributable releases;
- keyboard-complete and WCAG 2.2 AA workspace flows;
- a new contributor can locate ownership, contracts, tests, and operational evidence without archaeology;
- core user workflows work without external network access, except explicitly opted-in services.

## Product exclusions

- proprietary storage as the source of truth;
- ambient AI or plugin authority;
- hidden network fallbacks;
- chat-first navigation that displaces writing;
- decorative dashboard chrome that reduces working area;
- security claims for prototype encryption or unisolated third-party code;
- unsigned production release channels.

## Operating model

Scriptor is local-first. The renderer is untrusted relative to native authority. Tauri commands, daemon RPC, MCP, external processes, Git, keychain access, and backup/restore are explicit boundaries. Local logs and audit records are bounded and redacted; high-integrity mutation records are hash-chained.

## Roadmap policy

Roadmap documents describe options, not current behavior. A capability graduates only after it has:

- an owner and source entry point;
- explicit trust and failure semantics;
- tests for positive, negative, restart, and recovery paths;
- user/operator documentation;
- release inclusion and support status in the capability ledger.
