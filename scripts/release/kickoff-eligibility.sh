#!/usr/bin/env bash
# Distinguish already-published, safely retryable, and immutable-tag conflicts.
set -euo pipefail

if [ "${GITHUB_EVENT_NAME:-}" = 'workflow_run' ]; then
  if [ "${GITHUB_SHA:-}" != "${SOURCE_SHA:-}" ]; then
    echo '::notice::CI succeeded on another commit; skip stale release kickoff.'
    exit 0
  fi
  version=$(tr -d '[:space:]' < VERSION)
  tag="v$version"
  existing_commit=$(git ls-remote origin "refs/tags/$tag^{}" | awk 'NR == 1 {print $1}')
  if [ -z "$existing_commit" ]; then
    existing_commit=$(git ls-remote origin "refs/tags/$tag" | awk 'NR == 1 {print $1}')
  fi
  if [ -n "$existing_commit" ] && [ "$existing_commit" != "$GITHUB_SHA" ]; then
    echo "::error title=Immutable version tag conflict::$tag already points to $existing_commit, not this commit $GITHUB_SHA. Increment VERSION and create a new tag; never move or reuse an existing version tag." >&2
    exit 1
  fi
  if [ -n "$existing_commit" ]; then
    if [ -z "${GH_TOKEN:-}" ]; then
      echo '::error title=Release lookup unavailable::GH_TOKEN is required to check an existing release.' >&2
      exit 1
    fi
    release_status=$(curl --silent --show-error --connect-timeout 15 --max-time 30 \
      --output /dev/null --write-out '%{http_code}' \
      --header 'Accept: application/vnd.github+json' \
      --header "Authorization: Bearer $GH_TOKEN" \
      "${GITHUB_API_URL:-https://api.github.com}/repos/$GITHUB_REPOSITORY/releases/tags/$tag") || {
      echo "::error title=Release lookup failed::Cannot check $tag; refusing to treat a transport failure as a missing release." >&2
      exit 1
    }
    case "$release_status" in
      200) echo "::notice::$tag already tagged and released; no repeat dispatch."; exit 0 ;;
      404) echo "::notice::$tag is on this exact validated commit without a release; retry production dispatch without moving the tag." ;;
      *) echo "::error title=Release lookup failed::GitHub API returned HTTP $release_status for $tag; refusing duplicate dispatch." >&2; exit 1 ;;
    esac
  fi
fi

echo 'eligible=true' >> "$GITHUB_OUTPUT"
