# Mobile Foreground-Only Architecture

## Status

- **Phase**: D — Strategic Expansion
- **Priority**: Medium

## Overview

Scriptor's mobile target (iOS / Android via Tauri Mobile) runs in a **foreground-only** model. There is no background daemon, no background indexing, and no background sync. All operations pause when the app is backgrounded and resume when the user returns.

## Core Principles

### 1. No Background Daemon

On desktop, Scriptor runs a daemon process (`scriptor-daemon`) that handles indexing, file watching, git sync, and MCP server hosting. On mobile, **none of this exists**.

| Operation | Desktop | Mobile |
|-----------|---------|--------|
| Vault indexing | Daemon (background) | On foreground resume |
| File watching | Daemon (notify crate) | On foreground resume (full rescan) |
| Git sync | Daemon (periodic) | Manual pull/push on foreground |
| MCP server | Daemon (long-running) | Not available |
| Export | Daemon (background job) | Foreground only (blocking) |
| Search | Daemon (FTS5 cache) | On-demand (no persistent cache) |

### 2. Save-on-Background Lifecycle

When the user switches away from Scriptor on mobile, the app must:

```
┌─────────────────────────────────────────────────┐
│ App → Background                                 │
│                                                  │
│  1. Save current note (if dirty)                 │
│  2. Flush pending writes                         │
│  3. Clear sensitive data from memory (if vault   │
│     encryption is enabled)                       │
│  4. Cancel pending network requests              │
│  5. Release hardware resources (camera, etc.)    │
└─────────────────────────────────────────────────┘
```

Implementation via Tauri lifecycle events:

```rust
// apps/mobile/src/lifecycle.rs
tauri::Builder::default()
    .on_window_event(|event| {
        if let WindowEvent::MovedToBackground = event.event() {
            save_active_note();
            flush_writes();
            clear_volatile_state();
        }
        if let WindowEvent::MovedToForeground = event.event() {
            rescan_vault();
            refresh_index();
        }
    })
```

### 3. Simplified Workspace

Mobile uses a **single-pane** layout with no split views, no inspector rail, and no floating panels.

```
┌──────────────────────────┐
│         Top Bar          │
│  (vault name, actions)   │
├──────────────────────────┤
│                          │
│     Single Content       │
│     (editor OR vault     │
│      tree, switchable)   │
│                          │
│                          │
├──────────────────────────┤
│     Bottom Navigation    │
│  [Editor] [Search]       │
│  [Graph]  [Settings]     │
└──────────────────────────┘
```

#### Pane Modes

| Mode | Content | Notes |
|------|---------|-------|
| Editor | Markdown editor | Default view, soft keyboard friendly |
| Vault Tree | Note list / folder browser | Tap to open note in editor |
| Search | Full-text search | Results open in editor |
| Graph | Knowledge graph (simplified) | Touch-zoom, tap node → editor |
| Settings | Simplified settings | No vault config, just app prefs |

### 4. Touch Gestures

| Gesture | Action |
|---------|--------|
| Tap | Select / open |
| Long press | Context menu (rename, delete, move) |
| Swipe left (note list) | Delete / archive |
| Swipe right (note list) | Pin / organize |
| Pinch (graph) | Zoom |
| Two-finger scroll (editor) | Scroll with inertia |
| Pull down (note list) | Refresh / rescan |

### 5. No System Tray

Mobile has no system tray concept. The app is either foreground or not running.

### 6. No Deep Links (Initial)

Deep links (`scriptor://vault/path`) are not supported in the initial mobile release. This avoids the complexity of URL scheme registration on iOS/Android and the need for a routing layer.

Future: Add `Universal Links` (iOS) and `App Links` (Android) for `https://scriptor.app/vault/*`.

## Feature Matrix

| Feature | Desktop | Mobile |
|---------|---------|--------|
| Multi-pane workspace | ✅ | ❌ |
| Split editor + preview | ✅ | ❌ |
| Inspector rail | ✅ | ❌ |
| Command palette (Ctrl+K) | ✅ | ❌ (use bottom nav) |
| Canvas (whiteboard) | ✅ | ❌ (too complex for touch) |
| Portal / sticky notes | ✅ | ❌ |
| Knowledge workbench | ✅ | Simplified |
| Git integration | ✅ | Manual pull/push only |
| MCP server | ✅ | ❌ |
| Export (PDF, DOCX, HTML) | ✅ | ✅ (foreground, blocking) |
| Vault encryption | ✅ | ✅ |
| File watching | ✅ (daemon) | On resume only |
| Background indexing | ✅ | ❌ |
| Search (FTS5) | ✅ | ✅ (on-demand) |
| Graph view | ✅ | ✅ (simplified, touch) |
| Daily notes | ✅ | ✅ |
| Templates | ✅ | ✅ |
| Snippets | ✅ | ✅ |
| Spellcheck | ✅ | ✅ (OS-native) |
| System tray | ✅ | ❌ |
| Deep links | ✅ | ❌ (future) |
| Widget (home screen) | ❌ | ❌ (future) |
| Share extension | ❌ | ❌ (future) |

## Performance Budgets

| Metric | Target |
|--------|--------|
| Cold start | < 1.5s |
| Note open | < 200ms |
| Search (1000 notes) | < 500ms |
| Vault scan (1000 notes) | < 2s |
| Memory (idle) | < 80 MB |
| Battery drain (foreground) | < 5%/hour |

## Platform-Specific Notes

### iOS

- Background execution limited to ~30 seconds (background fetch)
- Use `UIApplication.beginBackgroundTask` for save-on-background
- WKWebView for rendering (Tauri default)
- No JIT compilation for WASM plugins

### Android

- Background execution via `WorkManager` (future)
- Use `Activity.onPause()` for save-on-background
- WebView for rendering
- Scoped storage compliance required

## Migration Path

1. **Phase 1**: Implement simplified mobile shell (single pane + bottom nav)
2. **Phase 2**: Save-on-background lifecycle handler
3. **Phase 3**: Touch gesture layer
4. **Phase 4**: Platform-specific optimizations (iOS/Android)
5. **Phase 5**: Share extension, widgets, deep links
