import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Monaco web workers — see src/lib/monaco-environment.ts (MonacoEnvironment.getWorker)
// https://github.com/microsoft/monaco-editor/blob/main/docs/integrate-esm.md#using-vite
export default defineConfig({
  plugins: [react()],
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
        },
      },
    },
  },
  optimizeDeps: {
    include: ['monaco-editor'],
  },
})
