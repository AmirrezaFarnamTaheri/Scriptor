# BL-39: WASM Plugin Runtime

## Status

- **Phase**: D — Strategic Expansion
- **Priority**: Medium
- **Tracking**: BL-39

## Current State

Scriptor plugins are **JS/TS modules** loaded in the Electron/Tauri renderer:

```
┌──────────────┐   import   ┌──────────────┐
│ Plugin Loader │ ─────────→ │ JS module     │
│ (renderer)    │            │ (full access) │
└──────────────┘            └──────────────┘
```

**Problems**:
- Plugins run in renderer process — crash = UI crash
- No sandbox — plugins can access filesystem, network, IPC
- Plugin bugs cause security issues and data loss
- No language diversity (JS/TS only)

## Proposed Architecture

WASM-based plugins with capability-scoped host ABI.

```
┌─────────────────────────────────────────────────────────────┐
│ scriptor-daemon                                              │
│                                                              │
│  ┌────────────────────────────────────────────────────┐     │
│  │ Plugin Manager                                       │     │
│  │                                                      │     │
│  │  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │     │
│  │  │ WASM Runtime │  │ WASM Runtime │  │ JS Runtime│  │     │
│  │  │ (wasmtime)   │  │ (wasmtime)   │  │ (existing)│  │     │
│  │  │              │  │              │  │           │  │     │
│  │  │ plugin-a.wasm│  │ plugin-b.wasm│  │ plugin-c  │  │     │
│  │  └──────┬───────┘  └──────┬───────┘  └─────┬─────┘  │     │
│  │         │                  │                 │        │     │
│  │         ↓                  ↓                 ↓        │     │
│  │  ┌──────────────────────────────────────────────┐    │     │
│  │  │ Host ABI (capability-gated)                   │    │     │
│  │  │                                              │    │     │
│  │  │  read_note(path) → string     [read-notes]   │    │     │
│  │  │  write_note(path, content)    [write-notes]  │    │     │
│  │  │  search(query) → hits         [search]       │    │     │
│  │  │  list_notes(filter) → paths   [read-notes]   │    │     │
│  │  │  get_frontmatter(path) → json [read-notes]   │    │     │
│  │  │  set_frontmatter(path, json)  [write-notes]  │    │     │
│  │  │  log(level, message)          [always]       │    │     │
│  │  │  now() → timestamp            [always]       │    │     │
│  │  └──────────────────────────────────────────────┘    │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## Host ABI Design

All host functions are imported by the WASM module. The runtime injects them at instantiation time.

### Capability Model

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginCapabilities {
    pub read_notes: bool,
    pub write_notes: bool,
    pub search: bool,
    pub canvas: bool,
    pub export: bool,
    pub network: bool,       // restricted to allowlist
    pub subprocess: bool,    // restricted to allowlist
}

impl Default for PluginCapabilities {
    fn default() -> Self {
        Self {
            read_notes: false,
            write_notes: false,
            search: false,
            canvas: false,
            export: false,
            network: false,
            subprocess: false,
        }
    }
}
```

### ABI Functions

```rust
// Host functions exposed to WASM guest
#[host_function]
fn read_note(caller: Caller<PluginState>, path_ptr: i32, path_len: i32) -> i64;
#[host_function]
fn write_note(caller: Caller<PluginState>, path_ptr: i32, path_len: i32, content_ptr: i32, content_len: i32) -> i32;
#[host_function]
fn search(caller: Caller<PluginState>, query_ptr: i32, query_len: i32, limit: i32) -> i64;
#[host_function]
fn list_notes(caller: Caller<PluginState>, filter_ptr: i32, filter_len: i32) -> i64;
#[host_function]
fn get_frontmatter(caller: Caller<PluginState>, path_ptr: i32, path_len: i32) -> i64;
#[host_function]
fn set_frontmatter(caller: Caller<PluginState>, path_ptr: i32, path_len: i32, json_ptr: i32, json_len: i32) -> i32;
#[host_function]
fn log(caller: Caller<PluginState>, level: i32, msg_ptr: i32, msg_len: i32);
#[host_function]
fn now(caller: Caller<PluginState>) -> i64;
```

### Memory Management

- Guest allocates linear memory for string passing
- Host reads guest memory via `caller.memory()`
- Return values use a shared ABI: `i64` = `(ptr << 32) | len` for strings
- Guest exports `alloc(size) → ptr` and `dealloc(ptr, size)` functions

## Plugin Manifest Extension

Extend the existing `PluginManifest` type:

```typescript
// packages/plugin-api/src/manifest.ts
export interface PluginManifest {
  // ... existing fields ...
  entrypoint?: {
    js?: string;        // existing JS entrypoint
    wasm?: string;      // new WASM entrypoint (relative path to .wasm file)
  };
  capabilities: PluginCapability[];  // existing, but extended
  permissions: PluginPermission[];   // existing
  hostAbiVersion?: string;           // e.g., "1.0.0"
}
```

### Validation additions

```typescript
// Add to VALID_CAPABILITIES
'wasm-plugin',

// Add validation in validatePluginManifest
if (manifest.entrypoint?.wasm) {
  if (!manifest.entrypoint.wasm.endsWith('.wasm')) {
    errors.push('wasm entrypoint must be a .wasm file')
  }
  if (!manifest.hostAbiVersion) {
    errors.push('hostAbiVersion required for WASM plugins')
  }
}
```

## Sandbox Model

| Capability | Default | Scoped? | Notes |
|-----------|---------|---------|-------|
| `read-notes` | Denied | Vault paths only | No `..` traversal |
| `write-notes` | Denied | Vault paths only | Atomic writes only |
| `search` | Denied | Current vault | No cross-vault |
| `canvas` | Denied | Read-only by default | Write requires explicit grant |
| `export` | Denied | Same as user | No elevated access |
| `network` | Denied | Allowlist only | e.g., `["api.example.com"]` |
| `subprocess` | Denied | Allowlist only | e.g., `["pandoc"]` |
| Filesystem | Denied | Never granted | Use `read_note`/`write_note` |
| Env vars | Denied | Never granted | Secrets via `get_secret` (future) |

### Network Allowlist

```json
{
  "permissions": [
    {
      "permission": "network",
      "allowlist": ["api.openai.com", "hooks.slack.com"]
    }
  ]
}
```

## Signed Marketplace

### Manifest Signing

```
┌─────────────────────────────────────────────────────┐
│ Plugin Package                                       │
│                                                      │
│  manifest.json          ← unsigned manifest          │
│  manifest.sig           ← Ed25519 signature          │
│  plugin.wasm            ← plugin binary              │
│  plugin.wasm.sig        ← Ed25519 signature          │
│                                                      │
│  Signed by: publisher key                            │
│  Verified by: Scriptor marketplace root key          │
└─────────────────────────────────────────────────────┘
```

### Verification Flow

```
1. Download plugin package
2. Verify manifest.sig against publisher public key
3. Verify plugin.wasm.sig against hash in manifest
4. Check publisher key against trusted keyring
5. If unknown publisher → prompt user for trust decision
6. Install only if all checks pass
```

### Key Management

```rust
// crates/daemon/src/plugin_verify.rs
pub struct PluginVerifier {
    trusted_keys: HashMap<String, PublisherKey>,
    marketplace_root: PublicKey,
}

impl PluginVerifier {
    pub fn verify_package(&self, package_path: &Path) -> Result<VerificationResult, VerifyError>;
    pub fn add_trusted_publisher(&mut self, publisher: &str, key: &PublicKey);
    pub fn remove_trusted_publisher(&mut self, publisher: &str);
}
```

## Runtime: wasmtime vs wasmer

| Feature | wasmtime | wasmer |
|---------|---------|--------|
| Bytecode Alliance | Yes (founder) | No |
| WASI support | Full | Full |
| Component Model | Yes | Partial |
| Cold start | ~5ms | ~3ms |
| Memory safety | Rust-native | Rust-native |
| Plugin size | ~1 MB runtime | ~800 KB runtime |

**Recommendation**: wasmtime — Bytecode Alliance backing, Component Model for typed ABI.

## IPC Commands

```rust
// Add to COMMAND_CATALOG
"plugin_install_wasm",
"plugin_uninstall_wasm",
"plugin_list_wasm",
"plugin_invoke",           // call a plugin export
"plugin_permissions_get",
"plugin_permissions_set",
```

## Migration Path

1. **Phase 1**: Add wasmtime dependency, implement host ABI stubs
2. **Phase 2**: Build WASM SDK (`scriptor-wasm-sdk` crate with guest bindings)
3. **Phase 3**: Migrate one existing JS plugin to WASM as proof
4. **Phase 4**: Plugin signing infrastructure
5. **Phase 5**: Marketplace submission pipeline

## Open Questions

- [ ] Component Model (WIT) vs raw Core WASM for host ABI?
- [ ] How to handle plugin-to-plugin communication (IPC bus)?
- [ ] Plugin resource limits (memory cap, execution timeout)?
- [ ] Debugging: how to trace WASM plugin execution?
- [ ] Hot-reload: restart daemon on plugin update?
