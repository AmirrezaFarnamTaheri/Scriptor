#!/usr/bin/env python3
"""Create a profile-driven lightweight Scriptor source archive.

Examples:
    python3 scripts/zip-lite.py
    python3 scripts/zip-lite.py ../Scriptor-lite.zip
    python3 scripts/zip-lite.py --profile source-review --output ../Scriptor-source-review.zip
    python3 scripts/zip-lite.py --profile runtime-lite --output ../Scriptor-runtime-lite.zip

`source-review` is the default and preserves static validation inputs, lockfiles,
platform branding, performance policy, tests, and deterministic fixtures. It
excludes only reconstructable dependency/build/runtime state.
"""
from __future__ import annotations

import argparse
import fnmatch
import json
import sys
import zipfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUTPUT = REPO_ROOT.parent / "Scriptor-lite.zip"
COMMON_EXCLUDE_DIR_NAMES = {
    "node_modules", "target", "dist", "dist-e2e", "playwright-report", "test-results",
    ".playwright-mcp", "coverage", ".nyc_output", ".cache", ".turbo", ".next",
    ".git", ".serena", ".claude", "gen", "binaries", "cache",
}
RUNTIME_LITE_EXTRA_DIR_NAMES = {"synthetic-1k", "synthetic-5k", "synthetic-25k", "screenshots.spec.ts-snapshots"}
COMMON_EXCLUDE_FILES = {".DS_Store", "Thumbs.db", "npm-debug.log", "yarn-debug.log", "yarn-error.log", "pnpm-debug.log", "lerna-debug.log"}
COMMON_EXCLUDE_GLOBS = ("*.wasm", "*.map", "*.log", "*.tmp", "*.bak", "*.orig", "*.tsbuildinfo", "*~")
PROFILE_REQUIRED_MANIFEST = REPO_ROOT / "scripts/packaging/source-review-required.json"


def profile_rules(profile: str) -> tuple[set[str], set[str], tuple[str, ...]]:
    dirs = set(COMMON_EXCLUDE_DIR_NAMES)
    files = set(COMMON_EXCLUDE_FILES)
    globs = COMMON_EXCLUDE_GLOBS
    if profile == "runtime-lite":
        dirs |= RUNTIME_LITE_EXTRA_DIR_NAMES
    return dirs, files, globs


def should_skip(path: Path, repo: Path, profile: str) -> bool:
    relative = path.relative_to(repo)
    if not relative.parts:
        return True
    excluded_dirs, excluded_files, excluded_globs = profile_rules(profile)
    if any(part in excluded_dirs for part in relative.parts):
        return True
    if path.name in excluded_files or any(fnmatch.fnmatch(path.name, pattern) for pattern in excluded_globs):
        return True
    return False


def source_review_required_paths() -> list[str]:
    raw = json.loads(PROFILE_REQUIRED_MANIFEST.read_text(encoding="utf-8"))
    if raw.get("schemaVersion") != 1 or not isinstance(raw.get("requiredPaths"), list):
        raise ValueError(f"invalid packaging manifest: {PROFILE_REQUIRED_MANIFEST}")
    return [str(item) for item in raw["requiredPaths"]]


def validate_profile_inputs(repo: Path, profile: str) -> list[str]:
    if profile != "source-review":
        return []
    missing = [relative for relative in source_review_required_paths() if not (repo / relative).is_file()]
    if missing:
        raise FileNotFoundError("source-review profile is missing required inputs: " + ", ".join(missing))
    return source_review_required_paths()


def build_zip(repo: Path, out: Path, profile: str) -> tuple[int, int]:
    required = validate_profile_inputs(repo, profile)
    out.parent.mkdir(parents=True, exist_ok=True)
    if out.exists():
        out.unlink()
    count = 0
    total_bytes = 0
    with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=5) as zf:
        for path in sorted(repo.rglob("*")):
            if not path.is_file() or path.resolve() == out.resolve() or should_skip(path, repo, profile):
                continue
            arcname = str(path.relative_to(repo.parent)).replace("\\", "/")
            zf.write(path, arcname)
            count += 1
            total_bytes += path.stat().st_size
        profile_record = {
            "schemaVersion": 1,
            "profile": profile,
            "requiredValidationInputs": required,
            "excludesReconstructableBuildState": True,
        }
        zf.writestr("Scriptor/PACKAGING_PROFILE.json", json.dumps(profile_record, indent=2) + "\n")
        count += 1
    return count, total_bytes


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("legacy_output", nargs="?", help="backward-compatible positional output path")
    parser.add_argument("--profile", choices=("source-review", "runtime-lite"), default="source-review")
    parser.add_argument("--output", help="archive output path")
    args = parser.parse_args(argv)
    if args.output and args.legacy_output:
        parser.error("use either positional output or --output, not both")
    return args


def main(argv: list[str] | None = None) -> int:
    args = parse_args(sys.argv[1:] if argv is None else argv)
    out = Path(args.output or args.legacy_output).resolve() if (args.output or args.legacy_output) else DEFAULT_OUTPUT
    try:
        count, src_bytes = build_zip(REPO_ROOT, out, args.profile)
    except (OSError, ValueError) as error:
        print(f"Packaging failed: {error}", file=sys.stderr)
        return 1
    out_bytes = out.stat().st_size
    print(f"Profile: {args.profile}")
    print(f"Repo: {REPO_ROOT}")
    print(f"Output: {out}")
    print(f"Files added: {count}")
    print(f"Uncompressed source bytes: {src_bytes:,}")
    print(f"Zip size: {out_bytes:,} ({out_bytes / 1024 / 1024:.2f} MiB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
