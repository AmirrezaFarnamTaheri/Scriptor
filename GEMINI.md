# Scriptor project guidance

## Verified stack

- React 19, TypeScript 6, Vite 8, and Lucide React.
- Rust 1.96.0 (2024 Edition) workspace crates under `crates/`.
- pnpm 10.33.0 is the repository package manager. Preserve `pnpm-lock.yaml` and use the existing `pnpm` scripts.
- The frontend uses semantic, layered CSS imported from `src/index.css`; Tailwind is not installed.
- Native desktop packaging is provided by Tauri 2 under `apps/desktop`.

## Source of truth

- Runtime dependencies and commands: `package.json` and workspace manifests (`Cargo.toml`, `pnpm-workspace.yaml`).
- Theme values, typography stacks, spacing, radii, shadows, and motion: `src/index.css` and `src/styles/`.
- Design principles and accessibility floor: `DESIGN.md`.
- Architecture and capability claims: `docs/ARCHITECTURE.md` and `docs/CAPABILITY-MATURITY.md`.
- Onboarding and directory guide: `docs/ONBOARDING.md`.
- Package boundaries: package entry points and the repository boundary validation scripts.

Do not duplicate token values or invent framework versions in secondary documentation. When documents disagree with executable configuration, update the document to match the configuration.

## UI & Frontend conventions

- Use semantic HTML before ARIA.
- Use `UnifiedPanelShell` for modal or docked panel surfaces that need consistent labelling, focus containment, Escape handling, and tab behavior.
- Keep visual tooltips out of the accessibility tree when the control already has a complete accessible name.
- Derive keyboard shortcut labels for the current platform rather than hard-coding macOS glyphs.
- Use semantic CSS variables instead of hard-coded colors, shadows, or font imports.
- Use system or locally bundled fonts only; do not load remote fonts.
- Treat components above 200 lines as decomposition candidates, not automatic violations.
- Add memoization only when prop identities remain stable and the render cost justifies it.
- Ensure all interactive components implement loading, empty, actionable error, and mutation confirmation states.

## Rust & Backend conventions

- Use `thiserror` for library crates in `crates/` and `anyhow` for applications (`crates/cli`, `crates/daemon`).
- Production code must not use `.unwrap()`; use `?` propagation, `expect()` for invariants indicating bugs, or explicit error handling.
- Every `unsafe` block must be preceded by an explicit `// SAFETY:` rationale comment.
- Never hold a Tokio `Mutex` or `RwLock` guard across an `.await` point.
- External processes must be launched strictly via `crates/system-bridge/src/process.rs` and validated against `process-launch-inventory.json`.

## Verification & Performance Gates

Use the narrowest relevant checks first, then the repository gates:

- `pnpm version:check`
- `pnpm check:governance`
- `pnpm check:contracts`
- `pnpm check:source`
- `cargo clippy --workspace --all-targets -- -D warnings`
- `pnpm check:deny`
- `pnpm test:rust`
- `pnpm lint`
- `pnpm build`
- `pnpm check:frontend-quality`
- `pnpm check:a11y`
- `pnpm check:a11y-axe`
- `pnpm test:e2e`
- `pnpm test:visual`
- `pnpm check:perf`

Do not claim a check passed unless its command completed successfully against the current commit.
