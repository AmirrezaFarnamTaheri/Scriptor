# Native Rust Citation Engine

## Status

- **Phase**: D — Strategic Expansion
- **Priority**: Medium

## Current State

Scriptor uses **citeproc-js** running inside a Web Worker for citation rendering.

```
┌─────────────┐    postMessage    ┌──────────────┐
│  Renderer    │ ───────────────→ │ Web Worker    │
│  (React)     │ ←─────────────── │ citeproc-js   │
└─────────────┘    result HTML    └──────────────┘
```

**Problems**:
- Cold-start ~400ms on large bibliographies (25k+ vault)
- JS heap pressure limits concurrent renders
- Locale data shipped as separate JSON bundles (~80 locales × 12 KB)
- Cannot run headless (blocks CI/SSG use case)

## Evaluation Criteria

| Criterion | Weight | Notes |
|-----------|--------|-------|
| CSL 1.0.2 compatibility | High | Must pass citeproc-js test suite |
| CSL-JSON input | High | Existing vault frontmatter maps to CSL-JSON |
| Locale bundle size | Medium | All 80 locales < 2 MB total |
| Render latency (25k vault) | High | < 50ms for single citation, < 2s for full bib |
| Bibliography sorting | Medium | Author-date, numeric, alphabetic |
| Note-style citations | Medium | Chicago note, MLA, etc. |
| Daemon-side execution | High | No JS runtime dependency |

## Candidates

### 1. citeproc-rs

- **Repo**: `https://github.com/zotero/citeproc-rs`
- **Status**: Maintained by Zotero team, production-grade
- **CSL compliance**: Full CSL 1.0.2 + CSL-M (Zotero extensions)
- **Locale**: Compiled-in locale data (~1.5 MB)
- **API**: Rust library, WASM target available
- **Risk**: Large dependency tree (~180 crates)

### 2. hayagriva

- **Repo**: `https://github.com/typst/hayagriva`
- **Status**: Typst's bibliography engine, active development
- **CSL compliance**: CSL 1.0.2 (no CSL-M yet)
- **Locale**: YAML-based locale data
- **API**: Pure Rust, lightweight
- **Risk**: Younger project, smaller test coverage

### Recommendation

**citeproc-rs** — highest CSL compliance, proven at Zotero scale, maintained by reference-management team.

## Proposed Architecture

```
┌─────────────────────────────────────────────────────┐
│ scriptor-daemon                                      │
│                                                      │
│  ┌───────────────┐     ┌──────────────────────┐     │
│  │ command_       │     │ citation_engine       │     │
│  │ gateway        │────→│ (new crate)           │     │
│  │                │     │                       │     │
│  │ cite_render()  │     │  citeproc_rs::Driver  │     │
│  │ cite_bib()     │     │  locale_cache         │     │
│  └───────────────┘     │  style_cache           │     │
│         │              └──────────────────────┘     │
│         │ IPC (serde)          │                     │
│         ↓                      ↓                     │
│  ┌─────────────┐    ┌──────────────────┐            │
│  │ Tauri / CLI  │    │ FTS5 index        │            │
│  │ (thin client)│    │ (citation keys)   │            │
│  └─────────────┘    └──────────────────┘            │
└─────────────────────────────────────────────────────┘
```

### New crate: `crates/citation-engine`

```rust
// crates/citation-engine/src/lib.rs
pub struct CitationEngine {
    processor: citeproc_rs::Driver,
    style_cache: HashMap<String, citeproc_rs::Style>,
    locale_cache: HashMap<String, citeproc_rs::Locale>,
}

#[derive(Serialize, Deserialize)]
pub struct CitationRequest {
    pub items: Vec<CitationItem>,
    pub style_id: String,
    pub locale: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct CitationResult {
    pub citations: Vec<String>,       // inline citation HTML
    pub bibliography: String,         // full bibliography HTML
    pub bibliography_entries: Vec<BibliographyEntry>,
}

impl CitationEngine {
    pub fn new() -> Result<Self, EngineError>;
    pub fn render(&mut self, request: &CitationRequest) -> Result<CitationResult, EngineError>;
    pub fn render_single(&mut self, item: &CitationItem, style: &str) -> Result<String, EngineError>;
    pub fn available_styles(&self) -> Vec<StyleInfo>;
    pub fn available_locales(&self) -> Vec<LocaleInfo>;
}
```

### Integration with command_gateway

```rust
// Add to command_gateway.rs COMMAND_CATALOG
"cite_render",
"cite_bib",
"cite_styles",
"cite_locales",

// Handler pattern (follows existing conventions)
fn handle_cite_render(state: &DaemonState, params: Value) -> Result<Value, String> {
    let request: CitationRequest = serde_json::from_value(params)?;
    let mut engine = state.citation_engine.lock().map_err(|e| e.to_string())?;
    let result = engine.render(&request).map_err(|e| e.to_string())?;
    Ok(serde_json::to_value(result).unwrap())
}
```

## Migration Path

1. **Phase 1**: Add `citeproc-rs` as dependency, build wrapper crate
2. **Phase 2**: Expose IPC commands, keep JS fallback via feature flag
3. **Phase 3**: Migrate renderer to use daemon-side rendering
4. **Phase 4**: Remove Web Worker, citeproc-js dependency

## Risks

- citeproc-rs CSL-M extensions may conflict with hayagriva if we switch later
- Large bibliography renders may block daemon event loop → use `tokio::task::spawn_blocking`
- Locale updates require recompilation → consider runtime locale loading

## Open Questions

- [ ] Should styles be bundled or loaded from vault `.csl` files?
- [ ] How to handle CSL-M (Zotero-specific) extensions for non-Zotero users?
- [ ] Cache invalidation strategy for bibliography when vault changes?
