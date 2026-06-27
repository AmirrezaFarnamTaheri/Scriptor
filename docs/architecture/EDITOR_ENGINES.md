# Editor Engines

Scriptor ships two Markdown editor engines: **CodeMirror 6** (default) and **Monaco Editor** (optional). Both render the same document model and share the same save pipeline, but they serve different workflows.

## CodeMirror 6 — Default Engine

CodeMirror is the primary editor. It is purpose-built for long-form Markdown writing and supports every Scriptor editing feature:

- **WYSIWYG decorations** — heading sizes, bold/italic rendering, link hiding, list markers
- **Vim mode** — full normal/insert/visual mode via `@replit/codemirror-vim`
- **Typewriter scrolling** — active line stays vertically centered
- **Distraction-free / Focus mode** — dims everything except the current paragraph
- **Spellcheck integration** — browser-native spellcheck with custom dictionaries
- **LanguageTool** — inline grammar/style highlights
- **Snippet variables** — `{{date}}`, `{{title}}`, etc. expand on insertion
- **Markdown autocomplete** — wikilinks, tags, headings, citations

CodeMirror loads eagerly with the app. Its bundle (~120 KB gzipped including extensions) is part of the initial chunk.

## Monaco Editor — Optional Engine

Monaco is the engine that powers VS Code. Scriptor loads it **lazily** — the ~350 KB gzipped bundle is only fetched when you first switch to Monaco mode.

Monaco is optimized for two scenarios:

1. **VS Code keybindings** — if you are accustomed to VS Code shortcuts, Monaco provides them natively
2. **MCP diff review** — when reviewing AI-generated changes or merge conflicts, Monaco's inline diff viewer provides a familiar experience

### Limitations in Monaco mode

The following features are **CodeMirror-only** and are automatically disabled when Monaco is active:

| Feature | CodeMirror | Monaco |
|---|---|---|
| WYSIWYG decorations | yes | no |
| Vim mode | yes | no |
| Typewriter scrolling | yes | no |
| Distraction-free mode | yes | no |
| LanguageTool highlights | yes | no |
| Snippet variables | yes | no |
| Scroll-sync with preview | yes | no |

Monaco renders plain Markdown text with syntax highlighting. It does support autocomplete for wikilinks, tags, and headings via a custom completion provider.

## When to Use Which

| Scenario | Recommended engine |
|---|---|
| Daily writing and note-taking | CodeMirror |
| Long-form drafting | CodeMirror |
| Vim keybindings | CodeMirror |
| Reviewing AI-generated diffs | Monaco |
| VS Code keybindings | Monaco |
| Merge conflict resolution | Monaco |

## Bundle Size Impact

| Engine | Bundle size (gzipped) | Loading strategy |
|---|---|---|
| CodeMirror 6 | ~120 KB | Eager (initial chunk) |
| Monaco Editor | ~350 KB | Lazy (on first switch) |

Because Monaco is lazy-loaded via `React.lazy()`, users who never switch to Monaco mode pay zero network cost for it.

## Toggling Between Engines

1. Click the **Monaco** button in the editor toolbar (bottom of the format bar)
2. The toggle persists in `localStorage` under `scriptor:editor-mode`
3. On next launch, Scriptor restores your last engine choice

The Vim, WYSIWYG, Typewriter, and Focus toolbar buttons are visually disabled when Monaco is active, since those features require CodeMirror.

## Architecture Notes

- Both engines receive the same `value` / `onChange` props and operate on the same draft state
- The `editorMode` state lives in `App.tsx` and is passed down to `EditorWorkspace`
- Monaco is imported with `React.lazy()` in `EditorWorkspace.tsx` and wrapped in `<Suspense>` with a loading fallback
- Monaco's completion context (note paths, tags, headings) is computed in `App.tsx` and passed as `monacoCompletionContext`
