---
title: Scriptor Project Notes
type: project
status: active
tags: [project, scriptor, development]
created: 2026-01-10
---

# Scriptor Project Notes

## Overview

Scriptor is a local-first Markdown knowledge workspace. This note tracks development progress and design decisions.

## Architecture

The app uses:
- **Tauri** for desktop shell (Rust backend + web frontend)
- **React** for the UI layer
- **Rust crates** for vault operations, indexing, and export
- **SQLite** for full-text search index

## Recent Decisions

1. **i18n framework**: Using a lightweight key-value approach with `en`, `de`, `fa` locales
2. **Encryption**: AES-256-GCM with Argon2id key derivation (opt-in)
3. **Mobile**: Foreground-only model, no background daemon

## Links

- Back to [[index|Research Index]]
- See also: [[references/einstein-1905|Einstein 1905]] (inspiration for simplicity)
- Daily log: [[daily/2026-01-15|2026-01-15]]
