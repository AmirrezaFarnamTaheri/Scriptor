# Upstream Research — AI / Copilot / MCP Cluster

Scope: obsidian-copilot, smart-connections, smart-composer, textgenerator,
obsidian-mcp-plugin, claude-code-mcp, obsidian-agent-client, CodeSpace.
Target: Scriptor (Tauri v2 + React 19 + Rust), `D:\GitHub\Scriptor`.

## Scriptor baseline (verified by reading the repo)

| Area | Current state | File |
|---|---|---|
| MCP server | stdio + in-process runtime, 15+ `mcp.*` tools | `packages/mcp/src/runtime.ts`, `stdio-server.ts` |
| Tool permissions | 4-rank mode ladder `off < read-only < draft < write-approved` | `packages/mcp/src/permissions.ts` |
| Scope registry | `TOOL_SCOPES` + `auditToolScopeDrift()` drift test | `packages/mcp/src/tool-scopes.ts` |
| Path safety | `assertVaultRelativePath`, `assertBoundedInt` | `packages/mcp/src/tool-contracts.ts` |
| Audit trail | `McpAuditRecord` (allowed/denied/failed) | `packages/core/src/contracts/mcp.ts`, `packages/mcp/src/audit.ts` |
| Draft/diff | `draft.ts`, `diff.ts`, `note-writes.ts`, `tag-patch.ts` | `packages/mcp/src/` |
| Redaction | `redaction.ts` | `packages/mcp/src/` |
| LLM backends | Ollama only (`OllamaBackend`) | `packages/mcp/src/llm-backends/ollama.ts` |
| Cloud LLM | single Rust command, hardcoded `gpt-4o-mini`, non-streaming | `apps/desktop/src-tauri/src/commands/system.rs:137` |
| Key storage | OS keychain + `SensitiveOperation::AiNetworkRequest` capability token | `commands/system.rs:97-137` |
| Frontend AI | `useAiProvider.ts` (provider `off | openai-compatible`), `AiProviderSettings.tsx` | `src/hooks/`, `src/components/` |
| Embeddings | `EmbeddingStore` (SQLite BLOB vectors, WAL) + `OllamaClient`; **incubating**, not in `default-members` | `crates/embeddings/src/lib.rs` |
| Lexical search | SQLite FTS5, `build_fts_query` with negation/OR tokens | `crates/indexer/src/search.rs` |
| Vector index | none wired to product build | — |

Gaps this research targets: no chat surface, no streaming, no multi-provider
abstraction, no RAG/context assembly, no prompt template system, no token/cost
accounting, no conversation persistence, no agent loop with tool calling, no
semantic search tool in the MCP catalog.

Confidence note: repo-internal Scriptor details above are verified by reading
files. Upstream details are from prior knowledge of these projects; exact
symbol names in upstream repos are marked *(approx)* where memory of the
identifier is not certain.

---

## 1. obsidian-copilot (logancyang)

**Purpose.** Full chat copilot inside Obsidian: chat sidebar, Vault QA (RAG over
the whole vault), inline selection commands, and an agent mode ("Copilot Plus")
with tools.

**Standout architecture.**
- **Chain abstraction.** A `ChainFactory`/`ChainManager` pair *(approx)* selects
  between `llm_chain` (plain chat), `vault_qa` (retrieval QA), and
  `copilot_plus` (agent + tools). Chain type is a user-visible setting, not an
  implicit heuristic — the user chooses the retrieval strategy, so behaviour is
  predictable. This is the best single idea in the repo.
- **Orama** as the embedded vector store, persisted as one file under
  `.obsidian/`, fully local. Index partition keyed by embedding model so
  switching models invalidates cleanly instead of mixing dimensions.
- **Provider matrix** via LangChain chat-model wrappers: OpenAI, Anthropic,
  Google, Cohere, Azure, OpenRouter, Groq, any OpenAI-compatible base URL, plus
  Ollama / LM Studio. Each entry carries capability flags gating chat vs
  embeddings vs tool calling.
- **Custom prompts as notes.** Prompts live as Markdown notes in a configurable
  folder with template variables (`{}` = selection, `{activeNote}`, `{#tag}`,
  `[[note]]`). The prompt library is vault data, versioned by the user's own
  sync/git — an excellent fit for Scriptor's local-first stance.
- **Streaming with abort.** Every chain call takes an `AbortController`; the UI
  renders token deltas plus a stop button.
- **Relevant-notes panel** reuses the same index as Vault QA.

**Extraction candidates.**
1. Chain registry → `packages/ai/src/chains/registry.ts`
   ```ts
   export type ChainKind = 'plain' | 'vault-qa' | 'agent'
   export interface Chain {
     kind: ChainKind
     run(input: ChainInput, signal: AbortSignal): AsyncIterable<ChainDelta>
   }
   export function selectChain(kind: ChainKind, deps: ChainDeps): Chain
   ```
2. Provider registry → `packages/ai/src/providers/registry.ts`
   ```ts
   export interface ProviderDescriptor {
     id: string                      // 'openai' | 'anthropic' | 'ollama' | ...
     label: string
     baseUrl: string
     keychainAccount: string | null  // null => local, no secret needed
     capabilities: { chat: boolean; embed: boolean; tools: boolean; stream: boolean }
   }
   export function resolveProvider(id: string): ProviderDescriptor
   ```
   Replaces `AiProviderId = 'openai-compatible' | 'off'` in
   `src/hooks/useAiProvider.ts` and lets `ai_provider_propose_draft`
   (`commands/system.rs:137`) stop hardcoding `gpt-4o-mini`.
3. Prompt-notes-as-templates → `packages/ai/src/prompts/vault-prompts.ts`
   ```ts
   export interface PromptTemplate { path: string; title: string; body: string; vars: string[] }
   export function listPromptTemplates(vault: VaultReader, folder: string): Promise<PromptTemplate[]>
   export function renderPrompt(tpl: PromptTemplate, ctx: PromptContext): string
   ```
4. Model-keyed index partitioning → `crates/embeddings/src/lib.rs`: add
   `model_id` and keep `dimension` in the row key scope so a model change is a
   partition swap rather than a silently corrupt mix. The current `SCHEMA` has
   `dimension` as a column but PK is `id` alone, so two models collide today.

**Limitations to avoid.** Heavy LangChain.js dependency (bundle size, frequent
breaking changes) — Scriptor should hand-roll the ~300-line chat/tool loop.
Index rebuilds are slow and block the UI on large vaults; Scriptor must embed in
the Rust daemon (`crates/daemon`), never the renderer.

---

## 2. smart-connections (brianpetro)

**Purpose.** Ambient semantic-similarity engine: a sidebar that continuously
shows notes and blocks semantically related to whatever you are editing, plus a
"Smart Chat" over the same index.

**Standout architecture.**
- **Block-level embeddings, not note-level.** The unit of retrieval is a
  heading-delimited block (`SmartBlock`) whose stable key is
  `path/to/note.md#Heading > Subheading`. Notes get an embedding too
  (`SmartSource`). This dual granularity is why its results feel sharper than
  whole-note RAG: you retrieve the paragraph, but you can still cite the note.
- **`smart-entities` / `smart-collections` layer.** A generic
  collection-of-embedded-items abstraction with pluggable adapters:
  `AjsonMultiFileCollectionDataAdapter` (append-only JSON lines per item) for
  persistence, `SmartEmbedModel` for the embedder, `SmartFs` for I/O. The
  append-only "ajson" format makes incremental writes cheap and crash-tolerant —
  a design worth stealing for Scriptor's embedding sidecar files.
- **Local-first embeddings by default.** Ships transformers.js with
  `TaylorAI/bge-micro-v2` / `bge-small` class models running in a Web Worker or
  iframe, so zero-config semantic search with no API key. Optional OpenAI
  `text-embedding-3-small` for higher quality.
- **Incremental re-embed via content hash.** Each item stores the hash of the
  embedded text; on file change it re-embeds only blocks whose hash moved.
  Scriptor already has `crates/indexer/src/hash.rs` — the same hash can gate
  embedding work.
- **Cosine nearest-neighbour with an exclusion filter** (exclude self, excluded
  folders, frontmatter-flagged notes) rather than an ANN index. Brute force over
  a few 100k vectors is fine and removes an entire dependency class.

**Extraction candidates.**
1. Block chunker → `crates/indexer/src/blocks.rs` (new)
   ```rust
   pub struct Block { pub key: String, pub heading_path: Vec<String>,
                      pub byte_range: Range<usize>, pub text: String, pub hash: String }
   pub fn split_blocks(markdown: &str, note_path: &str, max_chars: usize) -> Vec<Block>;
   ```
   Reuses the existing Markdown parse in `crates/indexer/src/parse.rs` and the
   outline logic already exposed via `mcp.inspectOutline`.
2. Embedding sidecar with append-only writes →
   `crates/embeddings/src/store.rs`: keep SQLite (already there) but add
   `blocks` table `(block_key PK, note_id, model_id, dimension, hash, vector BLOB)`
   and `upsert_if_hash_changed(block_key, hash, || embed())`.
3. Brute-force top-K with filters → `crates/embeddings/src/search.rs`
   ```rust
   pub struct SimilarityQuery { pub vector: Vec<f32>, pub k: usize,
                                pub exclude_note_ids: Vec<String>, pub min_score: f32 }
   pub fn nearest_blocks(store: &EmbeddingStore, q: &SimilarityQuery)
       -> Result<Vec<(String, f32)>, EmbeddingError>;
   ```
   `EmbeddingStore` already holds a `Mutex<Connection>`; add a warm in-memory
   `Vec<(String, Vec<f32>)>` cache loaded on daemon start.
4. Ambient "related" panel → `src/components/shell/InspectorRail.tsx` already
   exists as the host surface; add `src/components/ai/RelatedNotesPanel.tsx`
   driven by a debounced (500 ms) query on cursor's current block.
5. Local embedder → `crates/embeddings/src/local_model.rs` using
   `fastembed`/ONNX Runtime in Rust instead of transformers.js. Keeps it out of
   the renderer and out of Node; justified because the model runtime belongs
   next to the store.

**Limitations to avoid.** Licensing/monetisation friction around the "Smart
Connect" paid tier muddies which code is reusable — treat this as an *ideas*
source, and reimplement. Its settings surface is sprawling; Scriptor should ship
three knobs (model, folder excludes, top-K) not thirty.

---

## 3. smart-composer (glowingjade)

**Purpose.** Cursor-style AI writing assistant for Obsidian: chat with explicit
`@`-mention context, and an **Apply Edit** flow that shows a diff you accept or
reject block by block.

**Standout architecture.**
- **Explicit context mentions.** Instead of guessing what to retrieve, the user
  types `@note`, `@folder`, `@vault`, `@url` into the chat input. The message is
  a structured object with a `mentionables` array, not a flat string. This is the
  most important idea for Scriptor: retrieval that the user can see and audit.
- **Two-model apply pipeline.** A strong model produces a *sketch* of the edit
  (with `// ... existing code ...`-style elisions), then a cheap fast "apply
  model" expands the sketch against the real file to produce the final text.
  Halves cost and latency on large notes and avoids the strong model having to
  echo the entire document.
- **Diff-review UI.** Rendered as a CodeMirror decoration set with per-hunk
  accept/reject, not a modal. Nothing is written until accepted.
- **PGlite (Postgres-in-WASM) + pgvector** for the RAG store — a genuinely
  interesting choice: real SQL + real vector ops with no native dependency.
  Scriptor does not need it (it has native SQLite + a Rust daemon), but the
  *schema* is worth copying: `(id, path, mtime, content, embedding vector(N))`.
- **Per-model pricing table** with running cost display per conversation.
- **Template/prompt library** plus MCP client support (it can call external MCP
  servers as tools — the mirror image of Scriptor's MCP server).

**Extraction candidates.**
1. Mentionable context model → `packages/ai/src/context/mentionables.ts`
   ```ts
   export type Mentionable =
     | { kind: 'note'; path: string }
     | { kind: 'folder'; path: string; recursive: boolean }
     | { kind: 'block'; path: string; blockKey: string }
     | { kind: 'selection'; path: string; text: string }
     | { kind: 'vault' }                       // triggers semantic retrieval
     | { kind: 'url'; url: string }             // must go through safe-external-url
   export interface ChatTurn { role: 'user' | 'assistant'; text: string; mentionables: Mentionable[] }
   export function assembleContext(turn: ChatTurn, deps: ContextDeps): Promise<ContextBundle>
   ```
   `kind: 'url'` must route through the existing
   `src/lib/validate-safe-external-url-runner.ts` guard, and any fetch must go
   through the Rust side with `SensitiveOperation::AiNetworkRequest`, matching
   how `ai_provider_propose_draft` already gates egress.
2. Sketch→apply two-model pipeline → `packages/ai/src/apply/apply-edit.ts`
   ```ts
   export interface EditSketch { path: string; sketch: string; summary: string }
   export function expandSketch(sketch: EditSketch, current: string,
                                model: ProviderDescriptor, signal: AbortSignal): Promise<string>
   ```
   Output feeds the **existing** `packages/mcp/src/draft.ts` +
   `packages/mcp/src/diff.ts` so AI edits and MCP `mcp.proposePatch` edits share
   one approval path and one audit record. This is the highest-leverage
   integration in this document.
3. Per-hunk accept/reject decorations → `src/components/ai/DiffReview.tsx`,
   mounted against `src/components/editor/MonacoMarkdownEditor.tsx` (Monaco has
   a native `IEditorDecorationsCollection` + `DiffEditor`, so no CodeMirror
   port needed).
4. Cost accounting → `packages/ai/src/usage/pricing.ts`
   ```ts
   export interface ModelPrice { modelId: string; inputPerMTok: number; outputPerMTok: number }
   export function estimateCost(modelId: string, usage: TokenUsage): number
   export function recordUsage(conversationId: string, usage: TokenUsage): void
   ```
   Persist next to the MCP audit log so "what did the AI do and what did it
   cost" is one query.

**Limitations to avoid.** PGlite is a large WASM payload and a second database
engine — reject it; use `crates/embeddings` instead. Its MCP client support is
newer and less battle-tested than its chat core.

---

## 4. obsidian-textgenerator-plugin (nhaouari)

**Purpose.** Prompt-template engine for Obsidian: turn Markdown notes into
parameterised generators, run them against many providers, insert output into the
editor.

**Standout architecture.**
- **Templates are notes with frontmatter config + Handlebars body.** Frontmatter
  carries `promptId`, `name`, `description`, `author`, `version`, `disableProvider`,
  and model params (`temperature`, `max_tokens`, `frequency_penalty`). The body is
  a Handlebars template with helpers and partials. Multi-message prompts are
  expressed by `***` / role separators so one file can define a whole
  system+user+assistant sequence.
- **Template marketplace.** Community templates are installable packages fetched
  from a registry index; each package has a manifest and a set of prompt notes.
  Scriptor already has `packages/plugins` + `StorePanel.tsx`, so this maps onto
  existing infrastructure rather than needing new plumbing.
- **Context variables and extractors.** A `ContextManager` *(approx)* builds the
  Handlebars context: `title`, `content`, `selection`, `frontmatter`, `headings`,
  `starredBlocks`, `children`, `mentions`, plus **extractors** —
  `WebPageExtractor`, `YoutubeTranscriptExtractor`, `PDFExtractor`,
  `AudioExtractor`, `ImageExtractor` — each registered under a key so templates
  can call `{{#extract "web" url}}`.
- **Provider plugin surface.** Providers are classes with a shared interface
  (`generate`, `generateMultiple`, `calcTokens`); a "custom provider" lets users
  paste JS to shape request/response, which is how it supports long-tail APIs
  without code changes.
- **Streaming insertion at the cursor**, with output modes: insert, replace
  selection, append to note, new note, or into a specific frontmatter field.

**Extraction candidates.**
1. Template descriptor + renderer →
   `packages/ai/src/prompts/template.ts`
   ```ts
   export interface PromptFrontmatter {
     promptId: string; name: string; description?: string; version?: string
     model?: string; temperature?: number; maxTokens?: number
     outputMode: 'insert' | 'replaceSelection' | 'appendNote' | 'newNote' | 'frontmatterField'
   }
   export interface PromptDoc { frontmatter: PromptFrontmatter; messages: ChatMessage[] }
   export function parsePromptNote(markdown: string): PromptDoc
   export function renderPromptDoc(doc: PromptDoc, ctx: PromptContext): ChatMessage[]
   ```
   Use a tiny, sandboxed subset of Handlebars-style substitution
   (`{{var}}`, `{{#each}}`, `{{#if}}`) implemented in-house rather than pulling
   Handlebars in — arbitrary template execution over vault content is an
   injection surface, and Scriptor already runs untrusted code only via
   `crates/wasm-runtime`.
2. Output-mode dispatcher → `packages/ai/src/output/apply-output.ts`, delegating
   writes to `packages/mcp/src/note-writes.ts` so every path (AI, template, MCP)
   funnels through one write authority.
3. Extractor registry → `packages/ai/src/extractors/registry.ts`
   ```ts
   export interface Extractor { id: string; extract(input: string, signal: AbortSignal): Promise<string> }
   export function registerExtractor(e: Extractor): void
   ```
   Ship `web` (via the Rust `system-bridge` egress path + safe-external-url
   validation) and `pdf` first. **Do not** ship an extractor that performs
   network I/O from the renderer.
4. Template packages → reuse `packages/plugins` manifest machinery; a prompt pack
   is a plugin with `kind: 'prompt-pack'` and no code, so it needs no new
   permission model.

**Limitations to avoid.** The plugin's settings and provider code are large and
loosely typed; its "paste JS for a custom provider" escape hatch is a code-
execution hole Scriptor must not copy — express custom providers as *data*
(base URL + auth header + request/response JSON path mapping), not code.

---

## 5. obsidian-mcp-plugin / mcp-obsidian family

Identification: there are three distinct things in this space, and conflating
them causes design mistakes.
- **`MarkusPfundstein/mcp-obsidian`** — a *Python* MCP server (stdio) that talks
  to the vault through the **Local REST API** community plugin over
  `https://127.0.0.1:27124` with a bearer API key. Tools include
  `obsidian_list_files_in_vault`, `obsidian_list_files_in_dir`,
  `obsidian_get_file_contents`, `obsidian_simple_search`,
  `obsidian_complex_search` (JsonLogic over the vault),
  `obsidian_patch_content`, `obsidian_append_content`, `obsidian_delete_file`.
- **`obsidian-mcp-plugin` (aaronsb and others)** — an Obsidian *plugin* that
  embeds the MCP server in-process and exposes **streamable HTTP** on a local
  port, avoiding the REST-API dependency. It groups tools by *operation* rather
  than one tool per verb: `vault(action, ...)`, `edit(action, ...)`,
  `view(action, ...)`, `workflow(...)`, `system(...)` — a "semantic operations"
  design that keeps the tool count low so small models don't drown in a
  50-tool catalog.
- **`smithery`-hosted obsidian-mcp servers** — thin wrappers of the above,
  interesting only for their transport/auth conventions.

**Standout ideas.**
- **Operation-grouped tools with an `action` discriminator.** 5 tools × N actions
  beats 40 flat tools for model accuracy and for prompt-token cost. Scriptor's
  catalog is already at 15+ flat `mcp.*` names (`mcp.search`, `mcp.readNote`,
  `mcp.inspectBacklinks`, `mcp.inspectBrokenLinks`, `mcp.inspectOutline`,
  `mcp.inspectExportProfiles`, `mcp.listTags`, `mcp.searchByTag`,
  `mcp.exportGraph`, `mcp.inspectGraphSummary`, `mcp.traverseGraph`,
  `mcp.renderMarkdown`, `mcp.proposePatch`, `mcp.proposeTagPatch`, …) and is
  growing; grouping is worth doing before it doubles.
- **Patch semantics targeted at structure, not offsets.** `patch_content` takes
  `{ targetType: 'heading' | 'block' | 'frontmatter', target, operation:
  'append' | 'prepend' | 'replace' }`. Structural targeting survives concurrent
  edits far better than line/offset diffs — directly relevant because Scriptor's
  `mcp.proposePatch` currently takes whole-document `proposedMarkdown` plus a
  `baseContentHash`.
- **Local-only binding + bearer token.** Bind `127.0.0.1`, require a token, and
  refuse non-loopback origins.
- **Fragment/pagination returns.** Large file reads return a fragment with a
  continuation token instead of blowing the context — the same discipline
  Scriptor's `assertBoundedInt` enforces on `limit`.

**Extraction candidates.**
1. Grouped tool facade → `packages/mcp/src/tool-groups.ts`
   ```ts
   export type ToolGroup = 'vault' | 'view' | 'edit' | 'graph' | 'system'
   export interface GroupedToolDescriptor {
     group: ToolGroup
     actions: Record<string, { commandId: string; modeRequired: McpMode; schema: JsonSchema }>
   }
   /** Keeps the existing flat names as aliases so no client breaks. */
   export function expandGroupedTool(group: ToolGroup, action: string, args: unknown): { toolName: string; args: unknown }
   ```
   Must be reflected in `tool-scopes.ts` so `auditToolScopeDrift()` still returns
   empty — extend the drift test to walk group actions.
2. Structural patch target → extend `McpProposePatchInput` in
   `packages/mcp/src/tool-contracts.ts`
   ```ts
   export type PatchTarget =
     | { kind: 'document' }
     | { kind: 'heading'; headingPath: string[] }
     | { kind: 'block'; blockKey: string }
     | { kind: 'frontmatter'; field: string }
   export interface McpProposePatchInput {
     path: string; summary: string; baseContentHash?: string
     target?: PatchTarget                 // defaults to { kind: 'document' }
     operation?: 'replace' | 'append' | 'prepend'
     proposedMarkdown: string
   }
   ```
   Resolution of `heading`/`block` targets reuses the block splitter from §2.
3. HTTP transport alongside stdio → `packages/mcp/src/http-server.ts`, mirroring
   `stdio-server.ts`; bind loopback only, require a token minted by the Rust
   side (reuse the `authorization_token` / `require_sensitive_operation` pattern
   from `apps/desktop/src-tauri/src/commands/system.rs`) so the token story is
   identical to keychain writes and AI egress.
4. Pagination envelope → `packages/mcp/src/paging.ts`: `{ items, nextCursor }`
   applied to `mcp.search`, `mcp.listTags`, `mcp.searchByTag`, `mcp.readNote`.

**Limitations to avoid.** The REST-API-bridge design (Python server → HTTP →
plugin) adds two hops, a second language, and a second auth token for no benefit
in Scriptor's architecture — Scriptor's in-process `packages/mcp` runtime is
already the better shape. Do not add a Python component.

---

## 6. claude-code-mcp (steipete and similar)

**Purpose.** Wraps the Claude Code CLI as a single MCP tool so any MCP client can
delegate a whole task to an agent that has its own file access and inner tool loop.

**Standout architecture.**
- **One coarse tool, not many.** A single `claude_code` tool taking
  `{ prompt, workFolder }` *(approx)*. When the callee is itself an agent, the
  right interface is a *task*, not a set of primitives.
- **Working-directory scoping as the security boundary.** `workFolder` is
  validated and becomes the child CWD; everything the inner agent can touch is
  bounded by it.
- **Process lifecycle discipline.** Configurable timeout, explicit kill on
  cancel, stderr captured separately, exit-code taxonomy, retry with backoff on
  transient spawn failure. Env vars `MCP_CLAUDE_DEBUG`,
  `MCP_HEARTBEAT_INTERVAL_MS`, `MCP_EXECUTION_TIMEOUT_MS` *(approx)*.
- **Heartbeat/progress notifications** so long runs don't look hung.

**Extraction candidates.**
1. Sidecar agent runner → `crates/system-bridge/src/agent_process.rs` (new)
   ```rust
   pub struct AgentSpawnSpec {
       pub program: String,      // allow-listed binary id, NOT a raw path
       pub args: Vec<String>,
       pub cwd: PathBuf,         // must be inside the open vault
       pub timeout: Duration,
       pub env_allowlist: Vec<String>,
   }
   pub enum AgentEvent { Stdout(String), Stderr(String), Heartbeat, Exit(i32), TimedOut }
   pub fn spawn_agent(spec: AgentSpawnSpec) -> Result<mpsc::Receiver<AgentEvent>, BridgeError>;
   ```
   Rust, not Node: process spawning is already `crates/system-bridge`'s job, so
   the capability-token gate applies. Add `SensitiveOperation::AgentSpawn` in
   `apps/desktop/src-tauri/src/commands/system.rs` plus a settings allow-list of
   program ids — never accept an arbitrary executable path from the renderer.
2. Progress protocol → `packages/mcp/src/progress.ts`
   ```ts
   export interface ProgressEvent { runId: string; kind: 'heartbeat' | 'stdout' | 'stderr' | 'exit'; text?: string; code?: number }
   ```
3. Unify timeouts: `REQUEST_TIMEOUT_MS` (`src/hooks/useAiProvider.ts`) and
   `AI_REQUEST_TIMEOUT_SECS` (`commands/system.rs`) into one
   `packages/ai/src/limits.ts` so renderer and Rust cannot drift.

**Limitations to avoid.** `--dangerously-skip-permissions` is the posture
Scriptor must not adopt — the four-rank ladder in `permissions.ts` exists so
writes are approved. A delegated agent must emit *proposals* via `draft.ts`.
Shelling out to a vendor CLI is a supply-chain surface: opt-in, off by default,
never bundled.

---

## 7. obsidian-agent-client (ACP client in Obsidian)

Identification: an Obsidian plugin acting as a client for coding agents over
**ACP (Agent Client Protocol)** — the JSON-RPC protocol Zed defined so editors
can host agents (Claude Code, Gemini CLI, …) behind one interface. The plugin's
internals are *unverified*; the protocol shape is public and is the valuable part.

**Standout architecture.**
- **ACP separates "who runs the model" from "who owns the files."** The agent is
  a subprocess speaking JSON-RPC over stdio; the *client* (editor) owns the
  filesystem and implements callbacks: `fs/read_text_file`,
  `fs/write_text_file`, `session/request_permission`, `terminal/*`. All writes
  are performed by the editor after the editor asks the user. This is the
  cleanest answer to "host an agent without handing it my disk," and it maps
  almost exactly onto Scriptor's mode ladder.
- **Session lifecycle:** `initialize` (capability negotiation) → `session/new` or
  `session/load` (resumption) → `session/prompt` → stream of `session/update`
  notifications → `session/cancel`.
- **Rich streaming update kinds:** `agent_message_chunk`, `agent_thought_chunk`,
  `tool_call` (`status: pending | in_progress | completed | failed`),
  `tool_call_update`, and `plan` (a live task list the agent maintains). The
  client renders thinking, tool calls, and the plan as distinct affordances
  rather than one text blob.
- **Permission requests carry options.** `session/request_permission` returns a
  chosen option id (`allow_once`, `allow_always`, `reject_once`,
  `reject_always`) — "always allow this tool" is protocol-level, not bolted on.

**Extraction candidates.**
1. ACP client → `packages/ai/src/acp/client.ts`
   ```ts
   export interface AcpClient {
     initialize(caps: ClientCapabilities): Promise<AgentCapabilities>
     newSession(cwd: string, mcpServers: McpServerRef[]): Promise<string>
     loadSession(sessionId: string): Promise<void>
     prompt(sessionId: string, blocks: ContentBlock[]): AsyncIterable<SessionUpdate>
     cancel(sessionId: string): Promise<void>
   }
   export type SessionUpdate =
     | { kind: 'agent_message_chunk'; text: string }
     | { kind: 'agent_thought_chunk'; text: string }
     | { kind: 'tool_call'; id: string; title: string; status: ToolCallStatus; locations?: string[] }
     | { kind: 'tool_call_update'; id: string; status: ToolCallStatus; content?: string }
     | { kind: 'plan'; entries: { text: string; status: 'pending' | 'in_progress' | 'done' }[] }
   ```
   Transport over the Rust `spawn_agent` from §6 so process handling lives in one
   place.
2. Client-side filesystem callbacks → `packages/ai/src/acp/host-fs.ts`, backed by
   `packages/mcp/src/note-writes.ts` and `draft.ts`. Agent writes become drafts
   requiring approval unless mode is `write-approved`; reuse `modeAllowsTool`
   verbatim.
3. Permission option model → extend `packages/mcp/src/permissions.ts`
   ```ts
   export type PermissionDecision = 'allow_once' | 'allow_always' | 'reject_once' | 'reject_always'
   export interface PermissionGrant { toolName: string; scope: 'session' | 'persistent'; decision: PermissionDecision }
   export function evaluateGrant(mode: McpMode, toolName: string, grants: PermissionGrant[]): boolean
   ```
   Real gap today: `modeAllowsTool` is the only gate, so there is no per-tool
   "always allow" and no session-scoped grant.
4. Agent transcript UI → `src/components/ai/AgentTranscript.tsx`, with distinct
   renderers for message / thought (collapsed by default) / tool call (touched
   paths as links) / plan checklist.
5. Every `tool_call` and permission decision → an `McpAuditRecord`, so the
   existing audit surface covers agent activity for free.

**Limitations to avoid.** ACP is young and its schema still moves: pin a version
and validate every inbound message using the existing
`tsconfig.contracts.json` + `validate-runner.ts` discipline.

---

## 8. CodeSpace (code execution inside the note surface)

Identification: *unverified* as a single canonical repo. The category is
well-established in the Obsidian ecosystary by `twibiral/obsidian-execute-code`
(run fenced code blocks in ~20 languages, show stdout/stderr inline, persistent
per-language REPL sessions) and by Jupyter-style plugins. Treat the *pattern* as
the finding, not one project's code.

**Standout architecture.**
- **Fenced code block becomes a runnable cell.** A "Run" button is injected into
  each ` ```lang ` block; output renders in a sibling `<pre>` that is
  note-adjacent but never written into the note unless the user asks.
- **Per-language runner registry** with interpreter path, args, and a
  `pre`/`post` code injection hook (e.g. shims to capture plots or set the CWD).
- **Persistent named sessions** so consecutive blocks share state — keyed by
  note path + language, torn down on note close.
- **Magic comments** for behaviour: `// @label`, `// @pre`, `// @import` to
  compose blocks from other blocks, which turns a note into a literate program.

**Relevance to Scriptor.** This is the natural *tool surface* for the agent work
above: an agent that can propose and run a snippet, with output captured, is far
more useful than one that can only write prose. Scriptor already has the right
sandbox — `crates/wasm-runtime` — which is a strictly better answer than spawning
native interpreters.

**Extraction candidates.**
1. Runnable-block decoration → `src/components/editor/RunnableCodeBlock.tsx`,
   mounted from `MonacoMarkdownEditor.tsx` via a code-lens provider (Monaco
   `registerCodeLensProvider`), no DOM injection hacks needed.
2. Execution request contract → `packages/core/src/contracts/exec.ts`
   ```ts
   export interface ExecRequest {
     notePath: string; blockKey: string; language: 'js' | 'python-wasm' | 'shell'
     source: string; sessionId?: string; timeoutMs: number
   }
   export interface ExecResult {
     ok: boolean; stdout: string; stderr: string; durationMs: number; truncated: boolean
   }
   ```
3. WASM-first runner → `crates/wasm-runtime`: expose
   `run_snippet(ExecRequest) -> ExecResult` with no host filesystem, no network,
   fuel/instruction limits, and an output cap. Only fall back to
   `system-bridge::spawn_agent` for `language: 'shell'`, behind
   `SensitiveOperation::AgentSpawn` and off by default.
4. MCP exposure → new tool `mcp.runSnippet` with `modeRequired: 'write-approved'`
   (execution is at least as privileged as a write), registered in
   `tool-scopes.ts` so `auditToolScopeDrift()` stays green.
5. Session registry → `packages/ai/src/exec/sessions.ts`, keyed
   `${notePath}::${language}`, evicted on note close and on vault switch.

**Limitations to avoid.** The upstream plugins shell out to system interpreters
with the user's full privileges — unacceptable as a default in Scriptor.
Do not persist output into note bodies automatically (it corrupts diffs and
bloats the index); render it as ephemeral UI and offer an explicit "insert
output" action that goes through `note-writes.ts`.

---

## 9. Peer-feature comparison

### 9.1 Retrieval / context assembly

| Repo | Approach | Granularity | User-auditable |
|---|---|---|---|
| obsidian-copilot | Vault QA chain over Orama | note + chunk | partial |
| smart-connections | always-on cosine top-K | **block** (`note#H1 > H2`) | yes |
| smart-composer | explicit `@` mentions + optional vault RAG | note/folder/vault | **yes** |
| textgenerator | template variables pull fixed fields | note fields | yes |
| mcp-obsidian family | model calls `search` itself | note | yes (tool log) |

**Best of all worlds.** Default to explicit `@` mentions (smart-composer) —
auditable and cheap. Add `@vault` as the single implicit path, resolved by
block-level cosine retrieval (smart-connections) so the unit is a heading block
with a stable key. Always return source keys so the chat cites and links. Never
silently inject the whole vault.

### 9.2 Applying edits

| Repo | Mechanism | Review UX | Concurrency safety |
|---|---|---|---|
| obsidian-copilot | insert / replace selection | none (immediate) | weak |
| smart-composer | sketch → apply-model → diff | per-hunk accept/reject | mtime check |
| textgenerator | output modes (insert/append/new note) | none | none |
| mcp-obsidian | structural `patch_content` | client-side only | structural target |
| ACP clients | agent asks, client writes | permission prompt per write | client owns FS |
| **Scriptor today** | `mcp.proposePatch` whole-doc + hash | `diff.ts` + mode ladder | hash check |

**Best of all worlds.** Keep Scriptor's draft+hash+mode ladder as the single write
authority; add (a) structural `PatchTarget` so patches survive concurrent edits,
(b) sketch→apply expansion so large notes aren't echoed wholesale, (c) per-hunk
accept/reject in the Monaco diff editor, (d) ACP's
`allow_once | allow_always | reject_*` grants layered over `modeAllowsTool`.

### 9.3 Provider abstraction & secrets

| Repo | Providers | Secret storage | Local option |
|---|---|---|---|
| obsidian-copilot | ~10 via LangChain wrappers | plugin data.json (plaintext) | Ollama / LM Studio |
| smart-composer | ~8 + OpenAI-compatible | plugin settings | Ollama |
| textgenerator | many + user-supplied JS provider | plugin settings | local endpoints |
| smart-connections | embed-focused (transformers.js, OpenAI) | plugin settings | **default local** |
| **Scriptor today** | 1 OpenAI-compatible + Ollama | **OS keychain + capability token** | Ollama |

**Best of all worlds.** Scriptor's secret handling is already the strongest of the
set — keep the keychain + `require_sensitive_operation` gate and extend it to
per-provider accounts (`scriptor.ai.<providerId>`). Adopt the capability-flag
provider descriptor from copilot; adopt smart-connections' local-embeddings
default so semantic search works with zero keys. Reject textgenerator's
JS-defined providers: express custom providers as data (base URL, auth header
name, request/response JSON paths).

### 9.4 Tool catalog shape

| Repo | Shape | Count | Notes |
|---|---|---|---|
| mcp-obsidian (Python) | flat verb tools | ~9 | one tool per verb |
| obsidian-mcp-plugin | grouped `vault/edit/view/workflow/system` + `action` | 5 | best for small models |
| claude-code-mcp | one task tool | 1 | callee is an agent |
| **Scriptor today** | flat `mcp.*` | 15+ | growing |

**Best of all worlds.** Keep flat names as the stable wire contract (clients
depend on them), and add a grouped facade for model-facing advertisement so the
advertised catalog is ~6 tools. Enforce parity in `auditToolScopeDrift()`.

### 9.5 Indexing / vector store

| Repo | Store | Chunking | Incremental trigger |
|---|---|---|---|
| obsidian-copilot | Orama (JSON file) | note + fixed-size chunks | manual + on-save partial |
| smart-connections | ajson multi-file collection | **heading blocks** | **content hash per block** |
| smart-composer | PGlite + pgvector (WASM) | fixed chunks w/ overlap | mtime |
| **Scriptor today** | SQLite BLOB (`crates/embeddings`) | none yet | none |

**Best of all worlds.** SQLite in the Rust daemon (already built), block-level
chunking from smart-connections, per-block content hash gating re-embeds (reuse
`crates/indexer/src/hash.rs`), pgvector-style schema shape, brute-force cosine
top-K until the corpus exceeds ~200k blocks. No new database engine, no WASM
vector store, no ANN dependency.

### 9.6 Streaming & transcript rendering

| Repo | Streaming | Thinking | Tool calls | Plan |
|---|---|---|---|---|
| obsidian-copilot | token deltas + abort | no | minimal | no |
| smart-composer | token deltas | no | yes | no |
| textgenerator | streams into editor | no | no | no |
| ACP clients | deltas | **yes** | **yes, with status** | **yes** |
| **Scriptor today** | none (single JSON response) | no | no | no |

**Best of all worlds.** Adopt ACP's update taxonomy as Scriptor's internal
transcript event type even for plain (non-ACP) chat, so one renderer covers
local chat, cloud chat, and hosted agents. Stream from Rust via a Tauri event
channel — not from the renderer — so egress stays behind
`SensitiveOperation::AiNetworkRequest`.

---

## 10. Target architecture for Scriptor

New workspace package `packages/ai`, mirroring `packages/mcp` conventions
(`validate.ts` + `validate-runner.ts`, contracts in
`packages/core/src/contracts/ai.ts`, a `pnpm check:ai` script).

```
packages/ai/src/
  providers/registry.ts      provider descriptors + capability flags
  providers/openai.ts        OpenAI-compatible chat/embed (SSE parsing)
  providers/anthropic.ts     messages API + tool_use blocks
  chains/registry.ts         plain | vault-qa | agent
  chains/agent-loop.ts       tool-calling loop over the packages/mcp runtime
  context/mentionables.ts    @note @folder @block @selection @vault @url
  context/assemble.ts        budget-aware packing + source keys
  prompts/template.ts        prompt notes: frontmatter + safe substitution
  prompts/vault-prompts.ts   prompt-note discovery in a configured folder
  apply/apply-edit.ts        sketch -> expand -> draft via mcp/draft.ts
  usage/pricing.ts           token + cost accounting
  transcript/events.ts       ACP-shaped SessionUpdate union
  acp/client.ts              ACP JSON-RPC client (opt-in)
  exec/sessions.ts           runnable-block sessions
  limits.ts                  shared timeouts/caps (renderer + Rust parity)
```

Rust side:
- `crates/embeddings` promoted out of incubating: `blocks` table, `model_id`,
  hash-gated upsert, `nearest_blocks`, local ONNX embedder.
- `crates/indexer/src/blocks.rs`: heading-block splitter.
- `crates/system-bridge/src/agent_process.rs`: allow-listed sidecar spawn.
- `apps/desktop/src-tauri`: streaming chat command emitting Tauri events; new
  `SensitiveOperation::AgentSpawn`.

Renderer:
- `src/components/ai/ChatPanel.tsx`, `AgentTranscript.tsx`, `DiffReview.tsx`,
  `RelatedNotesPanel.tsx` (host surface: `src/components/shell/InspectorRail.tsx`).
- `src/hooks/useAiChat.ts`; `useAiProvider.ts` refactored onto the registry.

Invariant: every write from any AI path goes through
`packages/mcp/src/draft.ts` -> `note-writes.ts`, gated by `permissions.ts`, and
recorded as an `McpAuditRecord`. No second write path.

---

## 11. Implementation backlog

Effort in engineer-days for one engineer already fluent in the codebase.
"Blocked by" refers to items in this table.

### P0 — foundation (no user-visible AI feature is sound without these)

| # | Item | Files | Effort | Blocked by |
|---|---|---|---|---|
| P0-1 | `packages/ai` scaffold + contracts + `check:ai` runner | `packages/ai/**`, `packages/core/src/contracts/ai.ts`, `package.json` | 1.5 | — |
| P0-2 | Provider registry w/ capability flags; per-provider keychain accounts | `providers/registry.ts`, `commands/system.rs`, `useAiProvider.ts`, `AiProviderSettings.tsx` | 3 | P0-1 |
| P0-3 | Streaming chat in Rust (SSE parse) emitting Tauri events; replace hardcoded `gpt-4o-mini` | `commands/system.rs`, `src/bridge/commands.ts` | 3 | P0-2 |
| P0-4 | ACP-shaped transcript event union + `useAiChat` + `ChatPanel` | `transcript/events.ts`, `src/hooks/useAiChat.ts`, `src/components/ai/ChatPanel.tsx` | 4 | P0-3 |
| P0-5 | Shared `limits.ts` (timeouts, size caps) replacing duplicated constants | `packages/ai/src/limits.ts` + both call sites | 0.5 | P0-1 |
| P0-6 | Structural `PatchTarget` on `mcp.proposePatch` (+ heading/frontmatter resolution) | `tool-contracts.ts`, `runtime.ts`, `note-writes.ts` | 3 | P1-1 (block keys) |
| P0-7 | Permission grants (`allow_once`/`allow_always`/`reject_*`, session vs persistent) | `permissions.ts`, `tool-scopes.ts`, settings UI | 2.5 | — |

**P0 total: ~17.5 days.**

### P1 — the differentiating features

| # | Item | Files | Effort | Blocked by |
|---|---|---|---|---|
| P1-1 | Heading-block splitter + stable block keys | `crates/indexer/src/blocks.rs`, `parse.rs` | 2.5 | — |
| P1-2 | Promote `crates/embeddings`: `blocks` table, `model_id`, hash-gated upsert | `crates/embeddings/src/{lib,store}.rs`, `Cargo.toml` default-members | 3 | P1-1 |
| P1-3 | Local ONNX embedder (fastembed) so semantic search needs no API key | `crates/embeddings/src/local_model.rs` | 4 | P1-2 |
| P1-4 | `nearest_blocks` brute-force cosine + warm cache + filters | `crates/embeddings/src/search.rs`, `crates/daemon` | 2 | P1-2 |
| P1-5 | New MCP tool `mcp.semanticSearch` (read-only) + scope registration | `runtime.ts`, `tool-contracts.ts`, `tool-scopes.ts` | 1.5 | P1-4 |
| P1-6 | Mentionable context model + assembler with token budget | `context/mentionables.ts`, `context/assemble.ts` | 4 | P0-4, P1-5 |
| P1-7 | `@`-mention autocomplete in the chat composer | `src/components/ai/ChatPanel.tsx` | 2.5 | P1-6 |
| P1-8 | Sketch→apply pipeline emitting drafts; per-hunk diff review in Monaco | `apply/apply-edit.ts`, `src/components/ai/DiffReview.tsx` | 5 | P0-6 |
| P1-9 | Related-notes panel in the inspector rail (debounced block query) | `src/components/ai/RelatedNotesPanel.tsx`, `InspectorRail.tsx` | 2 | P1-4 |
| P1-10 | Agent loop with MCP tool calling + audit per tool call | `chains/agent-loop.ts`, `audit.ts` | 4 | P0-4, P0-7 |
| P1-11 | Prompt notes: frontmatter parse + safe substitution + output modes | `prompts/template.ts`, `output/apply-output.ts` | 3.5 | P0-4 |
| P1-12 | Token/cost accounting persisted beside the audit log | `usage/pricing.ts` | 1.5 | P0-3 |

**P1 total: ~35.5 days.**

### P2 — extensions, opt-in and off by default

| # | Item | Files | Effort | Blocked by |
|---|---|---|---|---|
| P2-1 | Grouped tool facade (`vault/view/edit/graph/system` + `action`) with flat aliases | `tool-groups.ts`, `tool-scopes.ts` | 3 | — |
| P2-2 | Pagination envelope (`{ items, nextCursor }`) across read tools | `paging.ts`, `runtime.ts` | 2 | P2-1 |
| P2-3 | Loopback HTTP/streamable transport for the MCP server + minted token | `packages/mcp/src/http-server.ts`, `commands/system.rs` | 4 | P0-7 |
| P2-4 | Sidecar agent spawn (`AgentSpawnSpec`, allow-list, heartbeat, cancel) | `crates/system-bridge/src/agent_process.rs`, `commands/system.rs` | 4 | P0-7 |
| P2-5 | ACP client + agent transcript with thought/tool/plan renderers | `acp/client.ts`, `acp/host-fs.ts`, `src/components/ai/AgentTranscript.tsx` | 6 | P2-4, P0-4 |
| P2-6 | Prompt packs as `kind: 'prompt-pack'` plugins in the store | `packages/plugins/**`, `src/components/StorePanel.tsx` | 3 | P1-11 |
| P2-7 | Extractor registry (`web`, `pdf`) routed through Rust egress + safe-URL guard | `extractors/registry.ts`, `crates/system-bridge` | 3.5 | P1-6 |
| P2-8 | Runnable code blocks via `crates/wasm-runtime` + `mcp.runSnippet` | `crates/wasm-runtime`, `contracts/exec.ts`, `RunnableCodeBlock.tsx` | 6 | P0-7 |
| P2-9 | Conversation persistence + resume (`session/load` semantics) | `packages/ai/src/sessions/**` | 3 | P0-4 |

**P2 total: ~34.5 days.**

### Sequencing note

P0-1 → P0-2 → P0-3 → P0-4 is the critical path and unlocks a usable streaming
chat in roughly two weeks. P1-1 → P1-2 → P1-4 is the second, independent track
(Rust-only) and can run in parallel. P1-8 is the highest user-visible payoff per
day once P0-6 lands. Everything in P2 is optional surface area; ship none of it
before the audit and permission story in P0-7 is complete.

### Explicit rejections

- LangChain.js (bundle weight, churn) — hand-roll the loop.
- PGlite / pgvector WASM — `crates/embeddings` already covers it.
- Python MCP bridge via Local REST API — two extra hops, second language.
- User-supplied JS provider definitions — code-execution hole; use data mapping.
- `--dangerously-skip-permissions`-style bypass — contradicts the mode ladder.
- Native interpreter spawning for code blocks as a default — WASM first.
