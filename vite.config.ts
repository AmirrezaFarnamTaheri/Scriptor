import { createRequire } from 'node:module'
import { defineConfig, normalizePath } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// These packages' browser exports access document/DOMParser during import.
// Their default exports are also their documented worker exports. Resolve from
// the actual importer so pnpm's transitive packages need no hoisted paths.
function workerSafeMarkdownDependencies(): Plugin {
  return {
    name: 'scriptor-worker-safe-markdown-dependencies',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!importer || ![
        'decode-named-character-reference',
        'hast-util-from-html-isomorphic',
      ].includes(source)) return null
      return normalizePath(createRequire(importer).resolve(source))
    },
  }
}

// Monaco web workers — see src/lib/monaco-environment.ts (MonacoEnvironment.getWorker)
// https://github.com/microsoft/monaco-editor/blob/main/docs/integrate-esm.md#using-vite
export default defineConfig({
  // Dev workers share the main plugin pipeline; only these two equivalent
  // Markdown utilities use the DOM-independent implementation there.
  plugins: [react(), { ...workerSafeMarkdownDependencies(), apply: 'serve' }],
  resolve: {
    // Linked workspace packages can otherwise resolve a different React copy
    // from pnpm's virtual store, which breaks hooks in production bundles.
    dedupe: ['react', 'react-dom'],
  },
  server: {
    host: '127.0.0.1',
    open: false,
  },
  // Classic (IIFE) worker bundles: ES-module workers never start under the
  // Tauri custom protocol in packaged builds; a classic worker is one same-
  // origin fetch with no module graph, which works under any protocol.
  worker: {
    format: 'iife',
    // Build workers have their own plugin pipeline and need fresh instances.
    plugins: () => [workerSafeMarkdownDependencies()],
  },
  build: {
    manifest: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
            return 'react-vendor'
          }
          // cytoscape is only needed by GraphPanel — keep it out of the main entry chunk
          if (id.includes('node_modules/cytoscape')) {
            return 'cytoscape-vendor'
          }
          // KaTeX is only needed when math fences are rendered — defer from entry
          if (id.includes('node_modules/katex')) {
            return 'katex-vendor'
          }
        },
      },
    },
  },
  optimizeDeps: {
    // Only root-resolvable packages belong here; linked workspace dependencies are auto-discovered.
    include: ['monaco-editor'],
  },
})
