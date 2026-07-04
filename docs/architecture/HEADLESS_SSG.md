# Headless SSG / CI Export

## Status

- **Phase**: D — Strategic Expansion
- **Priority**: Medium

## Current State

Scriptor exports via **renderer-initiated export profiles**:

```
┌──────────┐   export command   ┌──────────────────┐   pandoc   ┌──────────┐
│ Renderer  │ ────────────────→ │ command_gateway   │ ────────→ │ Output   │
│ (user)    │                   │ export_run()      │           │ files    │
└──────────┘                   └──────────────────┘           └──────────┘
```

**Problems**:
- Requires running Tauri/Electron app — no CI support
- Cannot export vault → static site in GitHub Actions
- Export profiles are UI-driven, not declarative
- No batch/headless mode

## Use Cases

1. **GitHub Actions**: Push vault → build static site → deploy to GitHub Pages
2. **GitLab CI**: Same as above for GitLab Pages
3. **Local build**: `scriptor export --profile blog --output ./dist`
4. **Scheduled builds**: Nightly vault → site export via cron

## Proposed Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│ CI Environment (GitHub Actions / GitLab CI / local)              │
│                                                                   │
│  ┌──────────────┐     ┌─────────────────────────────────────┐   │
│  │ scriptor-     │     │ Export Pipeline                      │   │
│  │ daemon        │────→│                                     │   │
│  │ (headless)    │     │  1. Load vault + export profile     │   │
│  │               │     │  2. Index vault (FTS5 + metadata)   │   │
│  │               │     │  3. Resolve wikilinks + backlinks   │   │
│  │               │     │  4. Apply templates                 │   │
│  │               │     │  5. Run pandoc / custom renderer    │   │
│  │               │     │  6. Copy static assets              │   │
│  │               │     │  7. Generate sitemap + RSS          │   │
│  │               │     │  8. Write to output directory       │   │
│  └──────────────┘     └─────────────────────────────────────┘   │
│         │                         │                              │
│         ↓                         ↓                              │
│  ┌──────────────┐     ┌─────────────────────┐                  │
│  │ scriptor-     │     │ dist/                │                  │
│  │ index.db      │     │  index.html          │                  │
│  │ (ephemeral)   │     │  notes/*.html        │                  │
│  └──────────────┘     │  assets/*            │                  │
│                       │  sitemap.xml         │                  │
│                       │  feed.xml            │                  │
│                       └─────────────────────┘                  │
└──────────────────────────────────────────────────────────────────┘
```

## CLI Interface

```bash
# Basic export
scriptor export --vault /path/to/vault --profile blog --output ./dist

# CI-optimized (no interactive prompts, exit codes)
scriptor export \
  --vault $GITHUB_WORKSPACE \
  --profile blog \
  --output ./dist \
  --ci \
  --fail-on-warnings

# List available profiles
scriptor export --list-profiles

# Validate profile without building
scriptor export --vault . --profile blog --validate-only
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Vault not found / unreadable |
| 2 | Profile not found / invalid |
| 3 | Build errors (broken links, missing templates) |
| 4 | Pandoc not found |
| 5 | Template error |

## Export Profile Schema

```toml
# .scriptor/export-profiles/blog.toml
[profile]
name = "blog"
description = "Static blog with Hugo-style layout"

[profile.source]
vault = "."                    # relative to profile location
include = ["posts/**", "pages/**"]
exclude = ["**/drafts/**", ".obsidian/**"]
filter = "tag:published"       # DQL filter expression

[profile.template]
engine = "handlebars"          # "handlebars" | "tera" | "custom"
main = "templates/blog.hbs"
note = "templates/note.hbs"
index = "templates/index.hbs"

[profile.output]
format = "html"                # "html" | "markdown" | "json"
directory = "./dist"
clean = true                   # wipe output dir before build
assets = ["static/**"]

[profile.features]
wikilinks = true               # convert [[wikilinks]] to <a>
backlinks = true               # generate backlink sections
tags = true                    # generate tag index pages
graph = true                   # generate graph data (JSON)
sitemap = true
rss = true
rss_limit = 20

[profile.pandoc]
enabled = true
args = ["--mathjax", "--highlight-style=tango"]
```

## Integration with Existing Export

The existing `command_gateway` has:

```rust
// Existing commands (from command_gateway.rs)
"export_run",           // runs an export job
"export_discover",      // finds pandoc + profiles
```

### New commands

```rust
// Add to COMMAND_CATALOG
"export_headless",      // headless export with CLI params
"export_validate",      // validate profile without building
"export_list_profiles", // list available profiles
```

### Daemon Mode

```rust
// crates/daemon/src/main.rs additions
#[derive(Parser)]
struct Cli {
    #[command(subcommand)]
    command: Option<Command>,

    #[arg(long)]
    headless: bool,  // run without IPC listener
}

enum Command {
    Export {
        #[arg(long)]
        vault: PathBuf,
        #[arg(long)]
        profile: String,
        #[arg(long)]
        output: PathBuf,
        #[arg(long)]
        ci: bool,
        #[arg(long)]
        fail_on_warnings: bool,
    },
    Serve {
        // existing IPC mode
    },
}
```

## GitHub Actions Integration

```yaml
# .github/workflows/publish-site.yml
name: Publish Scriptor Site

on:
  push:
    branches: [main]
    paths: ['vault/**']

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Scriptor
        run: |
          curl -fsSL https://scriptor.dev/install.sh | bash
          echo "$HOME/.scriptor/bin" >> $GITHUB_PATH

      - name: Export vault to static site
        run: |
          scriptor export \
            --vault ./vault \
            --profile blog \
            --output ./dist \
            --ci \
            --fail-on-warnings

      - name: Deploy to GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

## Template Data Model

```rust
#[derive(Serialize)]
pub struct NoteContext {
    pub path: String,
    pub title: String,
    pub content_html: String,
    pub frontmatter: serde_json::Value,
    pub tags: Vec<String>,
    pub backlinks: Vec<BacklinkEntry>,
    pub created: String,
    pub modified: String,
    pub word_count: usize,
}

#[derive(Serialize)]
pub struct SiteContext {
    pub site_title: String,
    pub site_url: String,
    pub build_time: String,
    pub notes: Vec<NoteContext>,
    pub tags: HashMap<String, Vec<String>>,
    pub graph: GraphData,
}
```

## Migration Path

1. **Phase 1**: Add `--headless` flag to daemon, implement CLI export command
2. **Phase 2**: Export profile schema, migrate existing profiles
3. **Phase 3**: Template engine integration (handlebars/tera)
4. **Phase 4**: GitHub Actions template, documentation

## Open Questions

- [ ] Should headless mode require a license key or be free?
- [ ] How to handle pandoc version pinning in CI?
- [ ] Incremental builds: only re-export changed notes?
- [ ] Custom renderers beyond pandoc (e.g., MDX, custom AST transforms)?
- [ ] Support for non-HTML output (PDF, ePub, DOCX)?
