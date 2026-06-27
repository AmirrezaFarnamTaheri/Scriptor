import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { buildForceNodes } from '../lib/forceGraph'
import { loadVaultPresetJson, saveVaultPresetJson, VAULT_GRAPH_PRESETS_PATH } from '../lib/vaultPresets'
import type { GraphQueryOutput } from '../types/vault'
import { GraphCanvas, type CanvasNode } from './GraphCanvas'

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
  vaultOpen?: boolean
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
  vaultOpen = false,
  onSelectNode,
  onClose,
  onDepthChange,
  onRefresh,
  onOpenWorkbench,
  depth,
  fullVault,
}: GraphPanelProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null)
  const [presets, setPresets] = useState<GraphPreset[]>(() => loadGraphPresets())
  const svgRef = useRef<SVGSVGElement>(null)
  const liveRegionRef = useRef<HTMLDivElement>(null)
  const [workerLayout, setWorkerLayout] = useState<CanvasNode[] | null>(null)
  const [workerLoading, setWorkerLoading] = useState(false)
  const USE_CANVAS_THRESHOLD = 100

  useEffect(() => {
    if (!vaultOpen) return
    void loadVaultPresetJson<GraphPreset[]>(VAULT_GRAPH_PRESETS_PATH).then((stored) => {
      if (stored && stored.length > 0) setPresets(stored)
    })
  }, [vaultOpen])

  const useCanvas = (graph?.nodes.length ?? 0) >= USE_CANVAS_THRESHOLD

  useEffect(() => {
    if (!graph || !useCanvas) {
      setWorkerLayout(null)
      setWorkerLoading(false)
      return
    }
    setWorkerLoading(true)
    const worker = new Worker(new URL('../workers/graph-layout.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent) => {
      if (e.data.type === 'done') {
        setWorkerLayout(e.data.nodes as CanvasNode[])
        setWorkerLoading(false)
      }
    }
    worker.postMessage({
      nodes: graph.nodes,
      edges: graph.edges,
      width: VIEW_WIDTH,
      height: VIEW_HEIGHT,
    })
    return () => worker.terminate()
  }, [graph, useCanvas])

  const layout = useMemo(() => {
    if (!graph || graph.nodes.length === 0) return []
    if (useCanvas && workerLayout) return workerLayout
    return buildForceNodes(graph.nodes, graph.edges, {
      width: VIEW_WIDTH,
      height: VIEW_HEIGHT,
    })
  }, [graph, useCanvas, workerLayout])

  const nodeById = useMemo(() => new Map(layout.map((node) => [node.id, node])), [layout])

  const adjacency = useMemo(() => {
    const map = new Map<string, string[]>()
    if (!graph) return map
    for (const node of layout) map.set(node.id, [])
    for (const edge of graph.edges) {
      map.get(edge.source)?.push(edge.target)
      map.get(edge.target)?.push(edge.source)
    }
    return map
  }, [graph, layout])

  const announce = useCallback(
    (nodeId: string) => {
      const node = nodeById.get(nodeId)
      if (!node || !liveRegionRef.current) return
      const connections = adjacency.get(nodeId)?.length ?? 0
      liveRegionRef.current.textContent = `${node.label}, ${connections} connection${connections === 1 ? '' : 's'}`
    },
    [nodeById, adjacency],
  )

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (layout.length === 0) return

      const currentId = focusedNodeId ?? layout[0].id

      switch (event.key) {
        case 'ArrowRight':
        case 'ArrowDown': {
          event.preventDefault()
          const neighbors = adjacency.get(currentId)
          if (neighbors && neighbors.length > 0) {
            const nextId = neighbors[0]
            setFocusedNodeId(nextId)
            announce(nextId)
          }
          break
        }
        case 'ArrowLeft':
        case 'ArrowUp': {
          event.preventDefault()
          const neighbors = adjacency.get(currentId)
          if (neighbors && neighbors.length > 0) {
            const nextId = neighbors[neighbors.length - 1]
            setFocusedNodeId(nextId)
            announce(nextId)
          }
          break
        }
        case 'Enter': {
          event.preventDefault()
          const node = nodeById.get(currentId)
          if (node?.path) onSelectNode(node.path)
          break
        }
        case 'Escape': {
          event.preventDefault()
          setFocusedNodeId(null)
          onClose()
          break
        }
        case 'Tab': {
          event.preventDefault()
          const currentIndex = layout.findIndex((n) => n.id === currentId)
          const direction = event.shiftKey ? -1 : 1
          const nextIndex = (currentIndex + direction + layout.length) % layout.length
          const nextId = layout[nextIndex].id
          setFocusedNodeId(nextId)
          announce(nextId)
          break
        }
        default:
          break
      }
    },
    [focusedNodeId, layout, adjacency, nodeById, announce, onSelectNode, onClose],
  )

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
          {vaultOpen ? (
            <button
              type="button"
              className="toolbar-button"
              onClick={() => {
                void saveVaultPresetJson(VAULT_GRAPH_PRESETS_PATH, presets)
                localStorage.setItem(GRAPH_PRESETS_KEY, JSON.stringify(presets))
              }}
            >
              Save presets
            </button>
          ) : null}
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

      <div ref={liveRegionRef} aria-live="polite" className="sr-only" />

      {useCanvas ? (
        workerLoading ? (
          <div className="graph-loading" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: VIEW_HEIGHT }}>
            <span>Computing layout...</span>
          </div>
        ) : (
          <GraphCanvas
            nodes={layout as CanvasNode[]}
            edges={graph.edges}
            focusPath={focusPath}
            width={VIEW_WIDTH}
            height={VIEW_HEIGHT}
            onSelectNode={onSelectNode}
          />
        )
      ) : (
      <svg
        ref={svgRef}
        className="graph-canvas force"
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        role="application"
        tabIndex={0}
        aria-label="Knowledge graph. Use arrow keys to navigate nodes, Enter to open, Escape to close."
        onKeyDown={handleKeyDown}
      >
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
          const isKeyboardFocused = focusedNodeId === node.id
          const fillColor = node.color ?? folderColor(node.path)
          const connectionCount = adjacency.get(node.id)?.length ?? 0
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
              role="button"
              aria-label={`${node.label}, ${connectionCount} connection${connectionCount === 1 ? '' : 's'}${isFocus ? ' (current focus note)' : ''}`}
            >
              {isKeyboardFocused && (
                <circle r={22} fill="none" className="graph-node-focus-ring" />
              )}
              <circle r={isFocus || isHovered ? 18 : 14} fill={fillColor} />
              <text y={28} textAnchor="middle">
                {node.label.length > 18 ? `${node.label.slice(0, 17)}...` : node.label}
              </text>
            </g>
          )
        })}
      </svg>
      )}
    </div>
  )
}
