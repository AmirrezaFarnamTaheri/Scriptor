#!/usr/bin/env bash
set -euo pipefail

repo="${1:-.}"
out="${2:-$repo/.history-audit}"

if ! git -C "$repo" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "history audit requires a canonical Git clone" >&2
  exit 2
fi

commit_count="$(git -C "$repo" rev-list --all --count)"
if [ "$commit_count" -lt 2 ]; then
  echo "history audit blocked: repository has only $commit_count commit; use the canonical clone with full history" >&2
  exit 3
fi

mkdir -p "$out"
git -C "$repo" rev-parse HEAD > "$out/head.txt"
git -C "$repo" fsck --full --strict > "$out/fsck.txt" 2>&1
git -C "$repo" shortlog -sne --all > "$out/contributors.txt"
git -C "$repo" log --all --format='%aN <%aE>' | sort | uniq -c | sort -nr > "$out/authorship.txt"
git -C "$repo" log --all --name-only --format= | sed '/^$/d' | sort | uniq -c | sort -nr | head -100 > "$out/hotspots.txt"
git -C "$repo" tag --list --format='%(refname:short) %(objectname) %(taggerdate:iso8601)' > "$out/tags.txt"
git -C "$repo" log --all --date=iso-strict --pretty=format:'%H|%aI|%aN|%aE|%s' > "$out/commits.txt"

# Conservative text-pattern sweep over every reachable revision. This is a
# triage aid, not a replacement for gitleaks/trufflehog in the canonical CI.
git -C "$repo" log -p --all --no-ext-diff -- . \
  | grep -Ein 'BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|github_pat_|ghp_[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16}|xox[baprs]-|sk_live_[A-Za-z0-9]+' \
  > "$out/secret-pattern-candidates.txt" || true

cat > "$out/README.txt" <<REPORT
History audit completed for: $(git -C "$repo" rev-parse --show-toplevel)
HEAD: $(git -C "$repo" rev-parse HEAD)
Commits: $commit_count

Review every secret-pattern candidate manually. Run a dedicated full-history
scanner in the canonical repository before release, acquisition, or relicensing.
Signed-tag verification and branch-protection evidence require the hosting
platform and are not inferred from this local report.
REPORT

echo "history audit evidence written to $out"
