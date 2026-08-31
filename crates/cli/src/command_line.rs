use std::path::PathBuf;

use clap::{Parser, Subcommand};
use clap_complete::Shell;

/// Process exit codes emitted by the `scriptor` binary.
///
/// This mapping is a stable CLI contract; codes are never reused or reassigned
/// without an explicit new-product contract.
///
/// | Code | Meaning |
/// |------|---------|
/// | 0    | Success |
/// | 1    | General runtime error (I/O, vault, daemon, RPC failure) |
/// | 2    | Usage error (reserved for clap argument parsing) |
/// | 3    | Lint findings present (`scriptor lint`) |
/// | 4    | Performance budget exceeded (`scriptor bench-*`) |
/// | 5    | Environment check failed (`scriptor doctor`) |
pub(crate) mod exit_code {
    /// Lint reported at least one issue.
    pub(crate) const LINT_ISSUES: i32 = 3;
    /// A benchmark exceeded its CI latency budget.
    pub(crate) const BUDGET_EXCEEDED: i32 = 4;
    /// One or more environment probes failed.
    pub(crate) const DOCTOR_FAILED: i32 = 5;
}

#[derive(Debug, Parser)]
#[command(
    name = "scriptor",
    version,
    about = "Scriptor command-line interface",
    after_help = "Exit codes: 0 success, 1 error, 2 usage, 3 lint issues, 4 budget exceeded, 5 doctor failure."
)]
pub(crate) struct Cli {
    #[arg(
        long,
        global = true,
        help = "Use deprecated in-process indexer (default routes index/search/health through daemon)"
    )]
    pub(crate) in_process: bool,
    #[arg(
        long,
        visible_alias = "no-prompt",
        global = true,
        help = "Never read stdin, prompt, or page output (for non-interactive/agent callers)"
    )]
    pub(crate) no_interactive: bool,
    #[command(subcommand)]
    pub(crate) command: Commands,
}

#[derive(Debug, Subcommand)]
pub(crate) enum Commands {
    /// Detect host OS metadata for diagnostics.
    SystemInfo,
    /// List persisted canvas boards in a vault.
    CanvasListDocuments {
        #[arg(value_name = "PATH")]
        path: PathBuf,
    },
    /// Save a canvas scene JSON file into a vault store.
    CanvasSaveDocument {
        #[arg(value_name = "PATH")]
        path: PathBuf,
        #[arg(long)]
        file: PathBuf,
    },
    /// Load a persisted canvas board from a vault by id.
    CanvasLoadDocument {
        #[arg(value_name = "PATH")]
        path: PathBuf,
        #[arg(long)]
        id: String,
    },
    /// Open a vault and print its descriptor.
    Open {
        #[arg(value_name = "PATH")]
        path: PathBuf,
    },
    /// Scan a vault and emit note entries as JSON.
    Scan {
        #[arg(value_name = "PATH")]
        path: PathBuf,
    },
    /// Read a note from a vault.
    Read {
        #[arg(value_name = "PATH")]
        path: PathBuf,
        #[arg(long)]
        note: String,
    },
    /// Open a terminal UI for local-first vault browsing.
    Tui {
        #[arg(value_name = "PATH")]
        path: PathBuf,
        #[arg(long, default_value_t = false)]
        smoke_test: bool,
        #[arg(
            long,
            default_value_t = false,
            help = "Use deprecated in-process indexer instead of daemon (default)"
        )]
        in_process: bool,
    },
    /// Interact with the headless Scriptor daemon over local IPC.
    Daemon {
        #[command(subcommand)]
        command: DaemonCommands,
    },
    /// Rebuild the derived index for a vault.
    RebuildIndex {
        #[arg(value_name = "PATH")]
        path: PathBuf,
    },
    /// Emit a vault health report from the derived index.
    Health {
        #[arg(value_name = "PATH")]
        path: PathBuf,
    },
    /// Emit detailed vault health diagnostics with issue rows.
    HealthDiagnostics {
        #[arg(value_name = "PATH")]
        path: PathBuf,
    },
    /// Lint vault notes for Foam-style issues (missing heading, stale wikilink definitions).
    Lint {
        #[arg(value_name = "PATH")]
        path: PathBuf,
        #[arg(long)]
        fix: bool,
        #[arg(long = "rule")]
        rules: Vec<String>,
        #[arg(long, default_value = "json")]
        format: String,
    },
    /// Search indexed notes with FTS.
    Search {
        #[arg(value_name = "PATH")]
        path: PathBuf,
        #[arg(value_name = "QUERY")]
        query: String,
        #[arg(long, default_value_t = 25)]
        limit: u32,
    },
    /// List backlinks for a note path.
    Backlinks {
        #[arg(value_name = "PATH")]
        path: PathBuf,
        #[arg(long)]
        note: String,
    },
    /// Query a focused knowledge graph from the derived index.
    Graph {
        #[arg(value_name = "PATH")]
        path: PathBuf,
        #[arg(long)]
        note: Option<String>,
        #[arg(long, default_value_t = 1)]
        depth: u32,
    },
    /// Grep note bodies in a vault (regex over file contents).
    Grep {
        #[arg(value_name = "PATH")]
        path: PathBuf,
        #[arg(value_name = "PATTERN")]
        pattern: String,
        #[arg(long, default_value_t = 50)]
        limit: u32,
    },
    /// Print heading outline for a note.
    Outline {
        #[arg(value_name = "PATH")]
        path: PathBuf,
        #[arg(long)]
        note: String,
    },
    /// Create or overwrite a note at a relative path.
    Note {
        #[arg(value_name = "PATH")]
        path: PathBuf,
        #[arg(long)]
        file: String,
        #[arg(long)]
        title: Option<String>,
        #[arg(long)]
        body: Option<String>,
        #[arg(long)]
        dry_run: bool,
    },
    /// Traverse graph steps from a focus note (MCP parity).
    TraverseGraph {
        #[arg(value_name = "PATH")]
        path: PathBuf,
        #[arg(long)]
        note: String,
        #[arg(long, default_value_t = 2)]
        depth: u32,
    },
    /// Export a note as TextBundle zip.
    TextBundleExport {
        #[arg(value_name = "PATH")]
        path: PathBuf,
        #[arg(long)]
        note: String,
        #[arg(long)]
        output: PathBuf,
    },
    /// Scaffold a Starlight site from vault notes (Foam publish parity).
    Publish {
        #[arg(value_name = "PATH")]
        path: PathBuf,
        #[arg(long)]
        output: PathBuf,
    },
    /// Resolve a Git merge conflict with ours/theirs.
    GitResolveConflict {
        #[arg(value_name = "PATH")]
        path: PathBuf,
        #[arg(long)]
        file: String,
        #[arg(long, default_value = "ours")]
        strategy: String,
    },
    /// Preview a rename transaction with link updates.
    RenameDryRun {
        #[arg(value_name = "PATH")]
        path: PathBuf,
        #[arg(long)]
        from: String,
        #[arg(long)]
        to: String,
        #[arg(long, default_value_t = true)]
        update_links: bool,
    },
    /// Apply a rename transaction with link updates.
    RenameApply {
        #[arg(value_name = "PATH")]
        path: PathBuf,
        #[arg(long)]
        from: String,
        #[arg(long)]
        to: String,
        #[arg(long, default_value_t = true)]
        update_links: bool,
    },
    /// Measure vault scan latency and emit JSON for CI budgets.
    BenchScan {
        #[arg(value_name = "PATH")]
        path: PathBuf,
        #[arg(long, default_value_t = 5)]
        iterations: u32,
    },
    /// Measure warm FTS search latency and emit JSON for CI budgets.
    BenchSearch {
        #[arg(value_name = "PATH")]
        path: PathBuf,
        #[arg(value_name = "QUERY")]
        query: String,
        #[arg(long, default_value_t = 10)]
        iterations: u32,
    },
    /// Measure tantivy warm search latency for the FTS5 comparison. Requires
    /// the `tantivy` feature.
    #[cfg(feature = "tantivy")]
    BenchTantivy {
        #[arg(value_name = "PATH")]
        path: PathBuf,
        #[arg(value_name = "QUERY")]
        query: String,
        #[arg(long, default_value_t = 10)]
        iterations: u32,
    },
    /// Generate a synthetic Markdown vault fixture for benchmarks.
    GenerateVault {
        #[arg(value_name = "OUTPUT")]
        output: PathBuf,
        #[arg(long, default_value_t = 100)]
        count: u32,
        #[arg(long, default_value = "notes")]
        prefix: String,
    },
    /// Discover Pandoc on PATH.
    ExportDiscover,
    /// Translate a PDF with pdf2zh (layout-preserving scientific translation).
    PdfTranslate {
        #[arg(value_name = "PDF")]
        input: PathBuf,
        #[arg(long = "lang-in", default_value = "en")]
        lang_in: String,
        #[arg(long = "lang-out", default_value = "zh")]
        lang_out: String,
        #[arg(long)]
        output: Option<PathBuf>,
    },
    /// Export a note through Pandoc.
    Export {
        #[arg(value_name = "PATH")]
        path: PathBuf,
        #[arg(long)]
        note: String,
        #[arg(long, default_value = "html")]
        format: String,
        #[arg(long)]
        dry_run: bool,
        #[arg(long = "extra-arg")]
        extra_arg: Vec<String>,
        #[arg(long)]
        output_subdir: Option<String>,
    },
    /// Show Git status for a vault root.
    GitStatus {
        #[arg(value_name = "PATH")]
        path: PathBuf,
    },
    /// Commit selected files in a vault Git repository.
    GitCommit {
        #[arg(value_name = "PATH")]
        path: PathBuf,
        #[arg(long)]
        message: String,
        #[arg(long, required = true)]
        file: Vec<String>,
    },
    /// Pull from upstream with fast-forward only.
    GitPull {
        #[arg(value_name = "PATH")]
        path: PathBuf,
    },
    /// Push to upstream.
    GitPush {
        #[arg(value_name = "PATH")]
        path: PathBuf,
    },
    /// Hit-test a canvas scene JSON file at a point.
    CanvasHitTest {
        #[arg(value_name = "FILE")]
        file: PathBuf,
        #[arg(long)]
        x: f64,
        #[arg(long)]
        y: f64,
    },
    /// Query visible blocks in a viewport bounds rectangle.
    CanvasQuery {
        #[arg(value_name = "FILE")]
        file: PathBuf,
        #[arg(long, default_value_t = 0.0)]
        x: f64,
        #[arg(long, default_value_t = 0.0)]
        y: f64,
        #[arg(long, default_value_t = 640.0)]
        width: f64,
        #[arg(long, default_value_t = 480.0)]
        height: f64,
    },
    /// Preview template insertion without mutating the scene file.
    CanvasTemplateDryRun {
        #[arg(value_name = "FILE")]
        file: PathBuf,
        #[arg(long)]
        template: String,
    },
    /// List built-in canvas templates.
    CanvasTemplates,
    /// Render a canvas snapshot (SVG, PNG, or PDF).
    CanvasSnapshot {
        #[arg(value_name = "FILE")]
        file: PathBuf,
        #[arg(long, default_value = "svg")]
        format: String,
        #[arg(long)]
        output: PathBuf,
        #[arg(long)]
        dry_run: bool,
    },
    /// Measure canvas hit-test frame latency for CI budgets.
    BenchCanvasHitTest {
        #[arg(value_name = "FILE")]
        file: PathBuf,
        #[arg(long, default_value_t = 120)]
        iterations: u32,
    },
    /// Measure canvas snapshot render latency for CI budgets.
    BenchCanvasSnapshot {
        #[arg(value_name = "FILE")]
        file: PathBuf,
        #[arg(long, default_value_t = 20)]
        iterations: u32,
    },
    /// Generate a shell completion script on stdout.
    Completions {
        #[arg(value_name = "SHELL")]
        shell: Shell,
    },
    /// Probe the local environment and report readiness diagnostics.
    Doctor {
        #[arg(value_name = "PATH")]
        path: Option<PathBuf>,
    },
    /// Clip a URL and save it as a Markdown note in the vault.
    ///
    /// Fetches the page, sanitizes it, extracts the article body, converts to
    /// Markdown, and writes through the vault's single write path (I-1).
    /// Gated by `SensitiveOperation::WebClip` (F-4).
    ///
    /// Exit code 0 on success; 1 on fetch/extraction/write failure.
    Clip {
        /// URL to clip.
        #[arg(value_name = "URL")]
        url: String,
        /// Vault root path.
        #[arg(long, short, value_name = "PATH")]
        path: PathBuf,
        /// Vault-relative output folder (default: 00-inbox).
        #[arg(long, short, value_name = "FOLDER", default_value = "00-inbox")]
        folder: String,
        /// Output filename template (supports {{date}}, {{title}}).
        #[arg(long, value_name = "TEMPLATE", default_value = "{{date}}-{{title}}.md")]
        filename: String,
        /// Print the generated Markdown to stdout instead of writing it.
        #[arg(long)]
        dry_run: bool,
    },
}

#[derive(Debug, Subcommand)]
pub(crate) enum DaemonCommands {
    /// Verify the daemon endpoint and return its version.
    Ping,
    /// Print the resolved daemon socket endpoint metadata.
    Endpoint,
}
