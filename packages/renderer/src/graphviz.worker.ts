import { instance } from '@viz-js/viz'
import { validateGraphvizSource, validateGraphvizOutput } from './graphviz-policy.ts'

self.onmessage = async (event: MessageEvent<unknown>) => {
  try {
    if (typeof event.data !== 'string') throw new Error('Invalid Graphviz request')
    const source = validateGraphvizSource(event.data)
    const viz = await instance()
    const svg = validateGraphvizOutput(viz.renderString(source, { format: 'svg', engine: 'dot' }))
    self.postMessage({ svg })
  } catch (error) {
    self.postMessage({ error: (error instanceof Error ? error.message : 'Graphviz rendering failed').slice(0, 2048) })
  }
}
