# Scriptor Project & Codebase Guidelines

## Stack & Core Conventions
- **Framework & Libraries:** React 18, Vite, TypeScript, Tailwind CSS v4, Lucide Icons.
- **Design System:** Space Mono brutalist theme (`design-system/scriptor/MASTER.md`), `#0F172A` background, `#22C55E` CTA accent.
- **Component Naming:** `PascalCase` for React components (`GitPanel.tsx`), `camelCase` for custom hooks (`useVault.ts`).
- **File Colocation:** Place panel styles, types, and hooks close to their owning components under `src/components/`.

## Architecture & Navigation Map (`/codenav`)
- **Panel Shell:** `src/components/chrome/UnifiedPanelShell.tsx` (Handles WCAG focus trapping, `aria-modal`, and `Esc` dismissal).
- **Core Panels:** `GitPanel.tsx`, `PluginPanel.tsx`, `McpPanel.tsx`, `SettingsPanel.tsx`, `KnowledgeWorkbench.tsx`.
- **Top & Mobile Nav:** `src/components/shell/AppTopBar.tsx`, `src/components/shell/MobileWorkspaceNav.tsx`.

## Key Performance & Quality Floor
- **Render Budget:** All component re-renders must complete in < `16ms`.
- **Ternary Render Guards:** Use `condition ? <Component /> : null` instead of falsy `&&` checks to avoid DOM artifact leakage.
- **Touch Targets:** Minimum `44x44px` hit areas on mobile viewports.

## Essential Scripts
- **TypeScript Verification:** `node node_modules/typescript/bin/tsc --noEmit`
- **Development Server:** `npm run dev`
- **Production Build:** `npm run build`
- **E2E & Visual Testing:** `npx playwright test`
