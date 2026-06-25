import { useMemo, useState } from 'react'

import { buildForceNodes } from '../lib/forceGraph'
import type { GraphQueryOutput } from '../types/vault'

interface GraphPreset {
  id: string
  label: string
  depth: number
  fullVault: boolean
}

const GRAPH_PRESETS_KEY = 'scriptor.graph.presets'

const FOLDER_COLORS = ['#6366f1', '#0ea5e9', '#14b8a6', '#f59e0b', '#ef4444', '#a855f7', '#22c55e']

function loadGraphPresets(): GraphPreset[] {
  try {
    const raw = localStorage.getItem(GRAPH_PRESETS_KEY)
    if (!raw) return defaultGraphPresets()
    const parsed = JSON.parse(raw) as GraphPreset[]
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : defaultGraphPresets()
  } catch {
    return defaultGraphPresets()
  }
}

function defaultGraphPresets(): GraphPreset[] {
  return [
    { id: 'local', label: 'Neighborhood (depth 2)', depth: 2, fullVault: false },
    { id: 'vault', label: 'Full vault', depth: 3, fullVault: true },
  ]
}

function folderColor(path: string): string {
  const folder = path.includes('/') ? path.split('/')[0] : '(root)'
  let hash = 0
  for (let index = 0; index < folder.length; index += 1) {
    hash = (hash * 31 + folder.charCodeAt(index)) >>> 0
  }
  return FOLDER_COLORS[hash % FOLDER_COLORS.length]
}

interface GraphPanelProps {
  graph: GraphQueryOutput | null
  focusPath: string | null
  graphGroups?: Array<{ tag_prefix: string; color: string }>
  onSelectNode: (path: string) => void
  onClose: () => void
  onDepthChange: (depth: number) => void
  onRefresh: (fullVault: boolean) => void
  onOpenWorkbench?: () => void
  depth: number
  fullVault: boolean
}

const VIEW_WIDTH = 720
const VIEW_HEIGHT = 420

export function GraphPanel({
  graph,
  focusPath,
  graphGroups = [],
  onSelectNode,
  onClose,
  onDepthChange,
  onRefresh,
  onOpenWorkbench,
  depth,
  fullVault,
}: GraphPanelProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [presets] = useState<GraphPreset[]>(() => loadGraphPresets())

  const layout = useMemo(() => {
    if (!graph || graph.nodes.length === 0) return []
    return buildForceNodes(graph.nodes, graph.edges, {
      width: VIEW_WIDTH,
      height: VIEW_HEIGHT,
    })
  }, [graph])

  const nodeById = useMemo(() => new Map(layout.map((node) => [node.id, node])), [layout])

  if (!graph) {
    return (
      <div className="graph-overlay" role="dialog" aria-label="Knowledge graph">
        <header className="graph-header">
          <h2>Knowledge Graph</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close graph">
            ×
          </button>
        </header>
        <p className="empty-state">Open a vault and select a note to explore links.</p>
      </div>
    )
  }

  return (
    <div className="graph-overlay" role="dialog" aria-label="Knowledge graph">
      <header className="graph-header">
        <div>
          <h2>Knowledge Graph</h2>
          <span>
            {graph.nodes.length} nodes · {graph.edges.length} edges
            {focusPath ? ` · focus ${focusPath}` : fullVault ? ' · vault view' : ''}
          </span>
        </div>
        <div className="graph-controls">
          {onOpenWorkbench ? (
            <button type="button" className="toolbar-button" onClick={onOpenWorkbench}>
              Workbench
            </button>
          ) : null}
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={depth === preset.depth && fullVault === preset.fullVault ? 'active' : undefined}
              onClick={() => {
                onDepthChange(preset.depth)
                onRefresh(preset.fullVault)
              }}
            >
              {preset.label}
            </button>
          ))}
          <label>
            Depth
            <input
              type="range"
              min={1}
              max={5}
              value={depth}
              onChange={(event) => onDepthChange(Number(event.target.value))}
            />
            <span>{depth}</span>
          </label>
          <button
            type="button"
            className={fullVault ? 'active' : undefined}
            onClick={() => onRefresh(!fullVault)}
          >
            {fullVault ? 'Focused view' : 'Vault view'}
          </button>
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close graph">
          ×
        </button>
      </header>

      {graphGroups.length > 0 ? (
        <div className="graph-group-legend" aria-label="Graph group colors">
          {graphGroups.map((group) => (
            <span key={group.tag_prefix} className="graph-group-chip">
              <i style={{ backgroundColor: group.color }} aria-hidden />
              #{group.tag_prefix}
            </span>
          ))}
        </div>
      ) : null}

      <svg className="graph-canvas force" viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`} role="img">
        <title>
          Force-directed graph with {graph.nodes.length} nodes and {graph.edges.length} edges
        </title>
        {graph.edges.map((edge) => {
          const source = nodeById.get(edge.source)
          const target = nodeById.get(edge.target)
          if (!source || !target) return null
          return (
            <line
              key={edge.id}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              className={edge.kind === 'wikilink' ? 'graph-edge wikilink' : 'graph-edge'}
              opacity={hoveredId && hoveredId !== edge.source && hoveredId !== edge.target ? 0.25 : 0.9}
            />
          )
        })}

        {layout.map((node) => {
          const isFocus = node.path === focusPath
          const isHovered = hoveredId === node.id
          const fillColor = node.color ?? folderColor(node.path)
          return (
            <g
              key={node.id}
              className={
                node.unresolved
                  ? 'graph-node unresolved'
                  : isFocus
                    ? 'graph-node focus'
                    : 'graph-node'
              }
              transform={`translate(${node.x}, ${node.y})`}
              onMouseEnter={() => setHoveredId(node.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => {
                if (node.path) onSelectNode(node.path)
              }}
              style={{ cursor: node.path ? 'pointer' : 'default' }}
            >
              <circle r={isFocus || isHovered ? 18 : 14} fill={fillColor} />
              <text y={28} textAnchor="middle">
                {node.label.length > 18 ? `${node.label.slice(0, 17)}…` : node.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
