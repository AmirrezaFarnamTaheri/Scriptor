import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation } from 'd3-force'
import { fitGraphLayoutToViewport, seedGraphLayout, separateGraphLayout } from '../lib/graphLayout'

interface WorkerNode {
  id: string
  label: string
  path: string
  unresolved: boolean
  color?: string
  x?: number
  y?: number
}

interface WorkerEdge {
  source: string
  target: string
}

interface LayoutRequest {
  nodes: WorkerNode[]
  edges: WorkerEdge[]
  width: number
  height: number
  iterations?: number
}

self.onmessage = (event: MessageEvent<LayoutRequest>) => {
  try {
    const { nodes, edges, width, height, iterations = 120 } = event.data

    if (nodes.length === 0) {
      self.postMessage({ type: 'done', nodes: [] })
      return
    }

    const simNodes = seedGraphLayout(nodes, width, height)

    const nodeIds = new Set(simNodes.map((n) => n.id))
    const links = edges
      .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
      .map((e) => ({ source: e.source, target: e.target }))

    const dense = simNodes.length >= 80
    const simulationIterations = dense ? Math.max(iterations, 200) : iterations
    const simulation = forceSimulation(simNodes)
      .force('charge', forceManyBody().strength(dense ? -110 : -280))
      .force('link', forceLink(links).id((n) => (n as { id: string }).id).distance(dense ? 72 : 110).strength(dense ? 0.42 : 0.55))
      .force('collide', forceCollide(dense ? 22 : 26).strength(1).iterations(dense ? 2 : 1))
      .force('center', forceCenter(width / 2, height / 2))
      .stop()

    for (let step = 0; step < simulationIterations; step += 1) {
      simulation.tick()
      if (step % 20 === 0) {
        self.postMessage({ type: 'tick', step, total: simulationIterations })
      }
    }

    // Dense graphs are evidence surfaces, not packing benchmarks. Reserve
    // additional interior breathing room and never upscale the completed force
    // layout to the viewport edge; this prevents the rectangular perimeter
    // crowding that made 100+ node screenshots unreadable.
    const fitPadding = dense ? Math.max(56, Math.min(width, height) * 0.07) : 44
    const maxFitScale = dense ? 1 : 1.25
    const fitted = fitGraphLayoutToViewport(
      simNodes.map((node) => ({
        id: node.id,
        x: node.x,
        y: node.y,
        label: node.label,
        path: node.path,
        unresolved: node.unresolved,
        color: node.color,
      })),
      width,
      height,
      fitPadding,
      maxFitScale,
    )
    const result = dense
      ? separateGraphLayout(fitted, width, height, fitPadding, 34, 14)
      : fitted

    self.postMessage({ type: 'done', nodes: result })
  } catch (error) {
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) })
  }
}
