# Contextual Help, Q&A, and tours

## Product contract

Help is an offline, read-only product surface. It explains the current application; it is not an AI support chat, an operator, or a permission broker. Guide steps never run commands, send mail, enable plugins, execute code, publish, restore, or delete data. Completion means the reader finished the walkthrough, not that an operation succeeded.

The authored registry is `src/lib/help/catalog.ts`. Each entry records its opening route, prerequisites, safety boundary, maturity, source owner, contextual selectors, steps, questions, related guides, and presentation policy. The registry includes individual widgets and docks as well as full panels. Unavailable features remain searchable with explicit prerequisites rather than being auto-enabled.

## When guidance appears

- **First app launch:** only the short workspace introduction. It is skippable and replayable through the existing onboarding path or Help.
- **Global Help:** one **Help & guides** control lives in the top bar, with the same entry available from the command palette. Product panels, cards, docks, editor toolbars, and modal headers do **not** receive injected question-mark controls.
- **Contextual Help:** **F1** resolves the focused feature, then the last interacted feature, then the workspace overview. **Shift+F1** starts/resumes that contextual tour directly.
- **First-open orientation:** complex, optional, experimental, or higher-consequence surfaces receive one non-modal invitation the first time they are opened after onboarding. The invitation offers **Open guide**, **Start tour**, or **Not now**. It never auto-starts a tour and is persisted so it does not repeatedly interrupt the user.
- **Manual-only guidance:** simple controls and urgent/recovery flows remain user-invoked through F1, Help search, or the command palette. Destructive/recovery surfaces such as restore, conflicts, permissions, rename, code execution, and proposal application are never interrupted by an automatic tutorial invitation.
- **Detailed tours:** every tour still starts only from an explicit user action. A first-open invitation is orientation, not authority and not automatic execution.

Closing a tour preserves its position. Finish is explicit; closing or skipping never marks it completed. Restart resets only that tour. Resetting Help progress requires confirmation and changes only the Help storage key, never the vault, editor preferences, or account credentials.

## Interaction and accessibility

F1 resolves the focused surface, then the last interacted surface, then the workspace overview. Shift+F1 opens the same topic directly in Tour view. The single top-bar Help control opens the workspace guide and searchable Help center. No contextual Help affordance is inserted into feature-owned headers or controls.

Show this control closes Help and reveals/focuses only an already-present target. It never clicks it or opens a hidden feature. Missing targets are explained with the entry route and prerequisites; progress is not silently advanced. Guide content is text, not rendered HTML. No search terms, vault contents, paths, messages, or tokens are collected or sent anywhere.

The Help dialog owns its accessible title, close control, tab sequence and topmost Escape registration while retaining the underlying feature. Dismissal returns focus to the invoker when it still exists. The overview target scope includes the whole workspace even though its single visible entry lives in the top bar.

The controls support the application's English, German, and Persian locales. The authored detailed corpus is currently English and is explicitly marked `lang=en`, `dir=ltr`; a localized notice explains that fallback instead of representing untranslated prose as localized. Translation expansion must keep stable guide ids and content parity.

## Persistence and validation

Progress uses the bounded, versioned `scriptor:help-guides:v1` local key. Unknown guide ids and invalid step values are rejected or normalized; denied/quota/corrupt storage degrades to an in-memory session with a visible warning. Per-guide progress is separate from onboarding completion and from any task authority.

`src/lib/help/help.test.ts` covers catalog completeness, first-run/first-open/manual policy, guide and direct Q&A search, progress, introduction persistence, storage failure, reload, and request validation. `e2e/help-scope-regressions.spec.ts` verifies that product chrome receives no injected Help controls, the one global Help entry remains visible, contextual F1 resolves the owning feature, and the workspace tour can reveal its target. Visual coverage also records the clean workspace state and an explicitly opened contextual guide.

New user surfaces should add a registry entry or explicitly link to an existing guide, classify their presentation as first-run, first-open, or manual, and keep source-owned selectors reachable by F1 and Show this control without adding another persistent Help button.

## Previous remediation checkpoint

Before starting this addition, PR #135 at `c6a714bff2c085d330144ad98dc6530fea1ab29e` passed CI, Desktop compile, Visual review, Documentation localization, and Starlight lock template workflows. This records that checkpoint; it does not claim these new Help changes have passed those workflows before they run.
