import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Monaco web workers — see src/lib/monaco-environment.ts (MonacoEnvironment.getWorker)
// https://github.com/microsoft/monaco-editor/blob/main/docs/integrate-esm.md#using-vite
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Linked workspace packages can otherwise resolve a different React copy
    // from pnpm's virtual store, which breaks hooks in production bundles.
    dedupe: ['react', 'react-dom'],
  },
  server: {
    host: '127.0.0.1',
    open: false,
  },
  worker: {
    format: 'es',
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
