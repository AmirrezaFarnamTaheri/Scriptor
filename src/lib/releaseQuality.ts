export interface BenchScript {
  id: string
  label: string
  command: string
  description: string
  category: 'startup' | 'index' | 'editor' | 'canvas' | 'release'
}

export const BENCH_SCRIPTS: BenchScript[] = [
  { id: 'startup', label: 'Startup', command: 'pnpm bench:startup', description: 'Cold app startup timing', category: 'startup' },
  { id: 'idle-memory', label: 'Idle memory', command: 'pnpm bench:idle-memory', description: 'Memory after vault idle', category: 'startup' },
  { id: 'vault-scan', label: 'Vault scan', command: 'pnpm bench:vault-scan', description: 'Full vault indexing pass', category: 'index' },
  { id: 'search', label: 'Search', command: 'pnpm bench:search', description: 'Indexed search latency', category: 'index' },
  { id: 'scan-1k', label: 'Scan 1k notes', command: 'pnpm bench:scan-1k', description: 'Large vault scan (1k)', category: 'index' },
  { id: 'scan-5k', label: 'Scan 5k notes', command: 'pnpm bench:scan-5k', description: 'Large vault scan (5k)', category: 'index' },
  { id: 'editor-latency', label: 'Editor latency', command: 'pnpm bench:editor-latency', description: 'Keystroke-to-paint editor latency', category: 'editor' },
  { id: 'large-note', label: 'Large note open', command: 'pnpm bench:large-note', description: 'Open very large markdown note', category: 'editor' },
  { id: 'canvas', label: 'Canvas interaction', command: 'pnpm bench:canvas', description: 'Canvas block placement benchmark', category: 'canvas' },
  { id: 'canvas-snapshot', label: 'Canvas snapshot', command: 'pnpm bench:canvas-snapshot', description: 'Canvas export snapshot timing', category: 'canvas' },
  { id: 'release', label: 'Full release gate', command: 'pnpm check:release', description: 'Complete release quality pipeline', category: 'release' },
]
