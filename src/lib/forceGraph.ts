import { forceCenter, forceLink, forceManyBody, forceSimulation } from 'd3-force'

import type { GraphEdge, GraphNode } from '../types/vault'

export interface ForceNode {
  id: string
  x: number
  y: number
  label: string
  path: string
  unresolved: boolean
  color?: string
}

export interface ForceLayoutOptions {
  width: number
  height: number
  iterations?: number
}

export function buildForceNodes(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options: ForceLayoutOptions,
): ForceNode[] {
  const { width, height, iterations = 120 } = options
  if (nodes.length === 0) return []

  const simNodes = nodes.map((node, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(nodes.length, 1)
    const radius = Math.min(width, height) * 0.28
    return {
      id: node.id,
      label: node.label,
      path: node.path,
      unresolved: node.unresolved,
      color: node.color,
      x: width / 2 + Math.cos(angle) * radius,
      y: height / 2 + Math.sin(angle) * radius,
    }
  })

  const nodeIds = new Set(simNodes.map((node) => node.id))
  const links = edges
    .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
    .map((edge) => ({ source: edge.source, target: edge.target }))

  const simulation = forceSimulation(simNodes)
    .force('charge', forceManyBody().strength(-280))
    .force('link', forceLink(links).id((node) => (node as { id: string }).id).distance(110).strength(0.55))
    .force('center', forceCenter(width / 2, height / 2))
    .stop()

  for (let step = 0; step < iterations; step += 1) {
    simulation.tick()
  }

  return simNodes.map((node) => ({
    id: node.id,
    x: Math.max(36, Math.min(width - 36, node.x ?? width / 2)),
    y: Math.max(36, Math.min(height - 36, node.y ?? height / 2)),
    label: node.label,
    path: node.path,
    unresolved: node.unresolved,
    color: node.color,
  }))
}
