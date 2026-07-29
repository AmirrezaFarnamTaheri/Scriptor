#!/usr/bin/env bash
set -euo pipefail

write_changes="${RECONCILE_WRITE:-0}"

python - <<'PY'
from pathlib import Path
import re

path = Path("crates/cli/src/tui.rs")
text = path.read_text(encoding="utf-8")
new_marker = "ratatui::try_init()?"
manual_tokens = ("enable_raw_mode", "EnterAlternateScreen", "LeaveAlternateScreen")

if new_marker in text and not any(token in text for token in manual_tokens):
    print("TUI terminal lifecycle is already normalized")
else:
    import_pattern = re.compile(
        r"use crossterm::\{\s*"
        r"event::\{self, Event, KeyCode, KeyEventKind\},\s*"
        r"execute,\s*"
        r"terminal::\{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen\},\s*"
        r"\};"
    )
    text, import_count = import_pattern.subn(
        "use crossterm::event::{self, Event, KeyCode, KeyEventKind};",
        text,
    )
    if import_count != 1:
        raise SystemExit(
            f"expected exactly one manual crossterm lifecycle import block, found {import_count}"
        )

    start_marker = "impl TerminalGuard {"
    end_marker = "pub fn safe_fit"
    if text.count(start_marker) != 1 or text.count(end_marker) != 1:
        raise SystemExit("unexpected TerminalGuard/safe_fit structure")
    start = text.index(start_marker)
    end = text.index(end_marker, start)
    old_block = text[start:end]
    required = [
        "enable_raw_mode()?;",
        "EnterAlternateScreen",
        "ratatui::init()",
        "disable_raw_mode()",
        "LeaveAlternateScreen",
        "ratatui::restore();",
    ]
    missing = [token for token in required if token not in old_block]
    if missing:
        raise SystemExit(f"TerminalGuard block missing expected tokens: {missing}")

    new_block = """impl TerminalGuard {
    fn enter() -> Result<(Self, DefaultTerminal), Box<dyn std::error::Error>> {
        Ok((Self, ratatui::try_init()?))
    }
}

impl Drop for TerminalGuard {
    fn drop(&mut self) {
        ratatui::restore();
    }
}

"""
    text = text[:start] + new_block + text[end:]
    path.write_text(text, encoding="utf-8")
    print("Normalized TUI terminal lifecycle")
PY
rustfmt --edition 2024 crates/cli/src/tui.rs

python - <<'PY'
from pathlib import Path

path = Path("crates/tantivy-indexer/src/lib.rs")
text = path.read_text(encoding="utf-8")
old = "let top_docs = searcher.search(&query, &TopDocs::with_limit(limit))?;"
new = "let top_docs = searcher.search(&query, &TopDocs::with_limit(limit).order_by_score())?;"

if new in text and old not in text:
    print("Tantivy score collector is already migrated")
else:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"expected exactly one Tantivy 0.22 TopDocs call, found {count}")
    path.write_text(text.replace(old, new), encoding="utf-8")
    print("Migrated Tantivy score collector")
PY
rustfmt --edition 2024 crates/tantivy-indexer/src/lib.rs

pnpm install --lockfile-only --no-frozen-lockfile
pnpm install --frozen-lockfile
pnpm build
pnpm lint

cargo update -p ratatui --precise 0.30.2
cargo check --workspace --exclude scriptor-desktop --locked
cargo test --workspace --exclude scriptor-desktop --locked

grep -F '"@types/node": "^26.1.2"' package.json
grep -F "'@types/node@26.1.2':" pnpm-lock.yaml

grep -F 'ratatui = "0.30.2"' crates/cli/Cargo.toml
test "$(grep -c '^name = "crossterm"$' Cargo.lock)" -eq 1
grep -A1 '^name = "crossterm"$' Cargo.lock | grep -F 'version = "0.29.0"'
grep -F 'ratatui::try_init()?' crates/cli/src/tui.rs
! grep -q 'enable_raw_mode\|EnterAlternateScreen\|LeaveAlternateScreen' crates/cli/src/tui.rs

grep -F 'resvg = "0.47"' crates/canvas-engine/Cargo.toml
grep -F 'tiny-skia = "0.12"' crates/canvas-engine/Cargo.toml
test "$(grep -c '^name = "resvg"$' Cargo.lock)" -eq 1
test "$(grep -c '^name = "usvg"$' Cargo.lock)" -eq 1
test "$(grep -c '^name = "tiny-skia"$' Cargo.lock)" -eq 1
grep -A1 '^name = "resvg"$' Cargo.lock | grep -F 'version = "0.47.0"'
grep -A1 '^name = "usvg"$' Cargo.lock | grep -F 'version = "0.47.0"'
grep -A1 '^name = "tiny-skia"$' Cargo.lock | grep -F 'version = "0.12.0"'

grep -F 'TopDocs::with_limit(limit).order_by_score()' crates/tantivy-indexer/src/lib.rs

if [[ "$write_changes" != "1" ]]; then
    echo "Read-only validation completed; no repository write requested."
    exit 0
fi

if git diff --quiet -- pnpm-lock.yaml Cargo.lock crates/cli/src/tui.rs crates/tantivy-indexer/src/lib.rs; then
    echo "Sources and lockfiles already match the combined manifests."
    exit 0
fi

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git add pnpm-lock.yaml Cargo.lock crates/cli/src/tui.rs crates/tantivy-indexer/src/lib.rs
git commit -m "chore(deps): reconcile unified dependency graph"
git push origin HEAD:convergence/all-open-prs-2026-07-29
