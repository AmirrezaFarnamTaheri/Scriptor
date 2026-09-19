# Contextual Help, Q&A, and tours

## Product contract

Help is an offline, read-only product surface. It explains the current application; it is not an AI support chat, an operator, or a permission broker. Guide steps never run commands, send mail, enable plugins, execute code, publish, restore, or delete data. Completion means the reader finished the walkthrough, not that an operation succeeded.

The authored registry is `src/lib/help/catalog.ts`. Each entry records its opening route, prerequisites, safety boundary, maturity, source owner, contextual selectors, steps, questions, related guides, and presentation policy. The registry includes individual widgets and docks as well as full panels. Unavailable features remain searchable with explicit prerequisites rather than being auto-enabled.

## When guidance appears

- **First app launch:** only the short workspace introduction. It is skippable and replayable through the existing onboarding path and Help.
- **First feature use:** a small, dismissible, non-modal guide invitation for setup-heavy surfaces such as toolbar customization, citations, the workbench, graph, canvas, tasks, Kanban, reader, plugins/modules, Google, Gmail, AI, MCP, resource sync, Portal, Quick Capture, Appearance, docks, history, backup, and import. It never steals focus or starts a full tour. One invitation is shown at a time and each feature is offered once per local Help profile.
- **User invocation only:** destructive/recovery actions, permissions, code execution, conflicts, restores, renames, applying proposals, advanced settings, and ordinary writing/navigation widgets. Their help is always available without an automatic popup.
- **Every guide:** searchable, replayable, resumable, and available from F1 or a contextual question mark. Detailed tours always require user initiation.

First-use invitations can be disabled without disabling Help. Closing a tour preserves its position. Finish is explicit; closing or skipping never marks it completed. Restart resets only that tour. Resetting Help progress requires confirmation and changes only the Help storage key, never the vault, editor preferences, or account credentials.

## Interaction and accessibility

F1 resolves the focused surface, then the last interacted surface, then the workspace overview. Header affordances open the corresponding guide. The Help dialog owns its own accessible title, close control, tab sequence and topmost Escape registration, while retaining the underlying panel. Dismissal returns focus to the invoker when it still exists.

Show this control closes Help and reveals/focuses only an already-present target. It never clicks it or opens a hidden feature. Missing targets are explained with the entry route and prerequisites; progress is not silently advanced. Guide content is text, not rendered HTML. No search terms, vault contents, paths, messages, or tokens are collected or sent anywhere.

The controls support the application's English, German, and Persian locales. The authored detailed corpus is currently English and is explicitly marked `lang=en`, `dir=ltr`; a localized notice explains that fallback instead of representing untranslated prose as localized. Translation expansion must keep stable guide ids and content parity.

## Persistence and validation

Progress uses the bounded, versioned `scriptor:help-guides:v1` local key. Unknown guide ids and invalid step values are rejected or normalized; denied/quota/corrupt storage degrades to an in-memory session with a visible warning. Per-guide progress is separate from onboarding completion and from any task authority.

`src/lib/help/help.test.ts` covers catalog completeness, policies, search, progress, storage failure, reload, and request validation. Browser coverage must verify contextual invocation over an existing dialog, F1 while typing, Escape/focus restoration, first-use dismissal, manual replay, missing targets, resize/zoom, RTL, and the absence of automatic mutations. New user surfaces must add a registry entry or explicitly link to an existing guide, and test that their selectors remain reachable.

## Previous remediation checkpoint

Before starting this addition, PR #135 at `c6a714bff2c085d330144ad98dc6530fea1ab29e` passed CI, Desktop compile, Visual review, Documentation localization, and Starlight lock template workflows. This records that checkpoint; it does not claim these new Help changes have passed those workflows before they run.
