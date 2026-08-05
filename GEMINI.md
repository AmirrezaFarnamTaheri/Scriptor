# Scriptor project guidance

## Verified stack

- React 19, TypeScript 6, Vite 8, and Lucide React.
- pnpm 10.33.0 is the repository package manager. Preserve `pnpm-lock.yaml` and use the existing `pnpm` scripts.
- The frontend uses semantic, layered CSS imported from `src/index.css`; Tailwind is not installed.
- Native desktop packaging is provided by Tauri under `apps/desktop`.

## Source of truth

- Runtime dependencies and commands: `package.json` and workspace manifests.
- Theme values, typography stacks, spacing, radii, shadows, and motion: `src/index.css` and `src/styles/`.
- Design principles and accessibility floor: `DESIGN.md`.
- Package boundaries: package entry points and the repository boundary validation scripts.

Do not duplicate token values or invent framework versions in secondary documentation. When documents disagree with executable configuration, update the document to match the configuration.

## UI conventions

- Use semantic HTML before ARIA.
- Use `UnifiedPanelShell` for modal or docked panel surfaces that need consistent labelling, focus containment, Escape handling, and tab behavior.
- Keep visual tooltips out of the accessibility tree when the control already has a complete accessible name.
- Derive keyboard shortcut labels for the current platform rather than hard-coding macOS glyphs.
- Use semantic CSS variables instead of hard-coded colors, shadows, or font imports.
- Use system or locally bundled fonts only; do not load remote fonts.
- Treat components above 200 lines as decomposition candidates, not automatic violations.
- Add memoization only when prop identities remain stable and the render cost justifies it.

## Verification

Use the narrowest relevant checks first, then the repository gates:

- `pnpm lint`
- `pnpm build`
- `pnpm check:frontend-quality`
- `pnpm check:a11y`
- `pnpm check:a11y-axe`
- `pnpm test:e2e`
- `pnpm test:visual`

Do not claim a check passed unless its command completed successfully against the current commit.
