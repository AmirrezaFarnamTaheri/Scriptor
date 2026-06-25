import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Monaco web workers — see src/lib/monaco-environment.ts (MonacoEnvironment.getWorker)
// https://github.com/microsoft/monaco-editor/blob/main/docs/integrate-esm.md#using-vite
export default defineConfig({
  plugins: [react()],
  worker: {
    format: 'es',
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/monaco-editor')) {
            return 'monaco'
          }
          if (id.includes('node_modules/@codemirror')) {
            return 'codemirror'
          }
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
            return 'react-vendor'
          }
        },
      },
    },
  },
  optimizeDeps: {
    include: [
      '@codemirror/commands',
      '@codemirror/lang-markdown',
      '@codemirror/language',
      '@codemirror/state',
      '@codemirror/view',
      'monaco-editor',
    ],
  },
})
