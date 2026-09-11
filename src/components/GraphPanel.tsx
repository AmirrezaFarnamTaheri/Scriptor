import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MoonStar, Power, X } from 'lucide-react'

// Classic bundled worker (vite worker.format=iife) - module workers never
// start under the Tauri custom protocol.
import GraphLayoutWorker from '../workers/graph-layout.worker.ts?worker'
import { useEscapeToClose } from '../hooks/useEscapeToClose'
import { useFocusTrap } from '../hooks/useFocusTrap'
import { usePluginState } from '../context/PluginStateContext.tsx'
import { loadVaultPresetJson, saveVaultPresetJson, VAULT_GRAPH_PRESETS_PATH } from '../lib/vaultPresets'
import type { GraphQueryOutput } from '../types/vault'
import { GraphCanvas, type CanvasNode } from './GraphCanvas'
import { useI18n } from '../lib/i18n'
import { expectArray, expectBoolean, expectNumber, expectRecord, expectString } from '../lib/runtimeSchema'
import { readVersionedStorage, writeVersionedStorage } from '../lib/versionedStorage'

interface GraphPreset {
  id: string
  label: string
  depth: number
  fullVault: boolean
}

const GRAPH_PRESETS_KEY = 'scriptor.graph.presets'

const FOLDER_COLORS = ['#6366f1', '#0ea5e9', '#14b8a6', '#f59e0b', '#ef4444', '#a855f7', '#22c55e']

function validateGraphPresets(value: unknown): GraphPreset[] {
  const parsed = expectArray(value, 'graph presets').map((item, index) => {
    const context = `graph presets[${index}]`
    const record = expectRecord(item, context)
    return {
      id: expectString(record, 'id', context),
      label: expectString(record, 'label', context),
      depth: Math.max(1, Math.min(5, expectNumber(record, 'depth', context))),
      fullVault: expectBoolean(record, 'fullVault', context),
    }
  })
  return parsed.length > 0 ? parsed : defaultGraphPresets()
}

function loadGraphPresets(): GraphPreset[] {
  return readVersionedStorage({
    key: GRAPH_PRESETS_KEY,
    schemaVersion: 1,
    fallback: defaultGraphPresets(),
    validate: validateGraphPresets,
  })
}

function defaultGraphPresets(): GraphPreset[] {
  return [
    { id: 'local', label: 'Neighborhood', depth: 2, fullVault: false },
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

function graphPairKey(source: string, target: string): string {
  return source < target ? `${source}\u0000${target}` : `${target}\u0000${source}`
}

interface GraphPanelProps {
  graph: GraphQueryOutput | null
  focusPath: string | null
  graphGroups?: Array<{ tag_prefix: string; color: string }>
  vaultOpen?: boolean
  vaultId?: string | null
  onSelectNode: (path: string) => void
  onClose: () => void
  onDepthChange: (depth: number) => void
  onRefresh: (fullVault: boolean) => void
  onOpenWorkbench?: () => void
  depth: number
  fullVault: boolean
  hibernated?: boolean
  onToggleHibernate?: () => void
}

const VIEW_WIDTH = 720
const VIEW_HEIGHT = 420

export function GraphPanel({
  graph,
  focusPath,
  graphGroups = [],
  vaultOpen = false,
  vaultId = null,
  onSelectNode,
  onClose,
  onDepthChange,
  onRefresh,
  onOpenWorkbench,
  depth,
  fullVault,
  hibernated = false,
  onToggleHibernate,
}: GraphPanelProps) {
  const { t } = useI18n()
  const { isPluginEnabled } = usePluginState()
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null)
  const [presets, setPresets] = useState<GraphPreset[]>(() => loadGraphPresets())
  const dialogRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const liveRegionRef = useRef<HTMLDivElement>(null)
  const [workerState, setWorkerState] = useState<{
    graph: GraphQueryOutput
    layout: CanvasNode[] | null
  } | null>(null)
  const USE_CANVAS_THRESHOLD = 100

  const isGraphEnabled = isPluginEnabled('scriptor.graph')

  useEscapeToClose(true, onClose)
  useFocusTrap(dialogRef, { active: true })

  useEffect(() => {
    if (!vaultOpen || !vaultId) return
    let cancelled = false
    void loadVaultPresetJson<GraphPreset[]>(VAULT_GRAPH_PRESETS_PATH).then((stored) => {
      if (!cancelled && stored && stored.length > 0) setPresets(stored)
    })
    return () => {
      cancelled = true
    }
  }, [vaultId, vaultOpen])

  const useCanvas = (graph?.nodes.length ?? 0) >= USE_CANVAS_THRESHOLD

  useEffect(() => {
    if (!graph || hibernated || !isGraphEnabled) return
    const requestedGraph = graph
    const worker = new GraphLayoutWorker()
    worker.onmessage = (event: MessageEvent) => {
      if (event.data.type === 'done') {
        setWorkerState({ graph: requestedGraph, layout: event.data.nodes as CanvasNode[] })
      } else if (event.data.type === 'error') {
        setWorkerState({ graph: requestedGraph, layout: null })
      }
    }
    worker.onerror = () => {
      setWorkerState({ graph: requestedGraph, layout: null })
    }
    worker.postMessage({
      nodes: graph.nodes,
      edges: graph.edges,
      width: VIEW_WIDTH,
      height: VIEW_HEIGHT,
    })
    return () => worker.terminate()
  }, [graph, hibernated, isGraphEnabled])

  const workerLayout = !hibernated && workerState?.graph === graph ? workerState.layout : null
  const workerLoading = Boolean(graph && !hibernated && workerState?.graph !== graph)

  const layout = useMemo(() => {
    if (!graph || graph.nodes.length === 0) return []
    if (workerLayout) return workerLayout
    return graph.nodes.map((node, index) => {
      const angle = (Math.PI * 2 * index) / Math.max(graph.nodes.length, 1)
      const radius = Math.min(VIEW_WIDTH, VIEW_HEIGHT) * 0.28
      return {
        id: node.id,
        label: node.label,
        path: node.path,
        unresolved: node.unresolved,
        color: node.color,
        x: VIEW_WIDTH / 2 + Math.cos(angle) * radius,
        y: VIEW_HEIGHT / 2 + Math.sin(angle) * radius,
      }
    })
  }, [graph, workerLayout])

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

  const reciprocalPairs = useMemo(() => {
    const directions = new Map<string, Set<string>>()
    if (!graph) return directions
    for (const edge of graph.edges) {
      const key = graphPairKey(edge.source, edge.target)
      const pairDirections = directions.get(key) ?? new Set<string>()
      pairDirections.add(`${edge.source}\u0000${edge.target}`)
      directions.set(key, pairDirections)
    }
    return directions
  }, [graph])

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
        default:
          break
      }
    },
    [focusedNodeId, layout, adjacency, nodeById, announce, onSelectNode, onClose],
  )

  if (!isGraphEnabled) {
    return (
      <div ref={dialogRef} className="graph-overlay" role="dialog" aria-modal="true" aria-label={t('graph.ariaLabel')}>
        <header className="graph-header">
          <h2>{t('graph.title')}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label={t('graph.closeGraph')}>
            <X aria-hidden="true" />
          </button>
        </header>
        <p className="empty-state" role="alert">Graph is disabled for this vault.</p>
      </div>
    )
  }

  if (hibernated) {
    return (
      <div ref={dialogRef} className="graph-overlay" role="dialog" aria-modal="true" aria-label={t('graph.ariaLabel')}>
        <header className="graph-header">
          <h2>{t('graph.title')}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label={t('graph.closeGraph')}>
            <X aria-hidden="true" />
          </button>
        </header>
        <div className="graph-hibernated-placeholder">
          <MoonStar className="graph-hibernated-icon" aria-hidden="true" />
          <h3>Graph paused</h3>
          <p>
            Background layout simulation is paused to optimize battery life and improve app responsiveness.
          </p>
          <button
            type="button"
            className="primary-button graph-wake-button"
            onClick={onToggleHibernate}
            disabled={!onToggleHibernate}
          >
            <Power aria-hidden="true" />
            Resume graph
          </button>
        </div>
      </div>
    )
  }

  if (!graph) {
    return (
      <div ref={dialogRef} className="graph-overlay" role="dialog" aria-modal="true" aria-label={t('graph.ariaLabel')}>
        <header className="graph-header">
          <h2>{t('graph.title')}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label={t('graph.closeGraph')}>
            <X aria-hidden="true" />
          </button>
        </header>
        <p className="empty-state">{t('graph.emptyState')}</p>
      </div>
    )
  }

  return (
    <div ref={dialogRef} className="graph-overlay" role="dialog" aria-modal="true" aria-label={t('graph.ariaLabel')}>
      <header className="graph-header">
        <div>
          <h2>{t('graph.title')}</h2>
          <span>
            {t('graph.nodeCount', { count: graph.nodes.length })} · {t('graph.edgeCount', { count: graph.edges.length })}
            {focusPath ? ` · ${t('graph.focus', { path: focusPath })}` : fullVault ? ` · ${t('graph.vaultView')}` : ''}
          </span>
        </div>
        <div className="graph-controls">
          {onOpenWorkbench ? (
            <button type="button" className="toolbar-button" onClick={onOpenWorkbench}>
              {t('graph.workbench')}
            </button>
          ) : null}
          <label className="graph-preset-picker">
            <span>{t('graph.view')}</span>
            <select
              value={presets.find((preset) => preset.depth === depth && preset.fullVault === fullVault)?.id ?? 'custom'}
              onChange={(event) => {
                const preset = presets.find((candidate) => candidate.id === event.target.value)
                if (!preset) return
                onDepthChange(preset.depth)
                onRefresh(preset.fullVault)
              }}
            >
              {presets.map((preset) => (
                <option key={preset.id} value={preset.id}>{preset.label}</option>
              ))}
              {!presets.some((preset) => preset.depth === depth && preset.fullVault === fullVault) ? (
                <option value="custom">{t('graph.custom')}</option>
              ) : null}
            </select>
          </label>
          {vaultOpen ? (
            <button
              type="button"
              className="toolbar-button"
              onClick={() => {
                void saveVaultPresetJson(VAULT_GRAPH_PRESETS_PATH, presets)
                writeVersionedStorage(GRAPH_PRESETS_KEY, 1, presets)
              }}
            >
              {t('graph.saveViews')}
            </button>
          ) : null}
          {!fullVault ? (
            <label>
              {t('settings.graphDepth')}
              <input
                type="range"
                min={1}
                max={5}
                value={depth}
                onChange={(event) => onDepthChange(Number(event.target.value))}
              />
              <span>{depth}</span>
            </label>
          ) : null}
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label={t('graph.closeGraph')}>
          <X aria-hidden="true" />
        </button>
      </header>

      <div className="graph-group-legend" aria-label={t('graph.legendAria')}>
        <span className="graph-group-chip">
          <svg className="graph-group-swatch" viewBox="0 0 10 10" aria-hidden="true">
            <circle cx="5" cy="5" r="4" fill="var(--primary)" />
          </svg>
          {t('graph.currentNote')}
        </span>
        <span className="graph-group-chip">
          <span aria-hidden="true">→</span>
          {t('graph.directedLink')}
        </span>
        {graphGroups.map((group) => (
          <span key={group.tag_prefix} className="graph-group-chip">
            <svg className="graph-group-swatch" viewBox="0 0 10 10" aria-hidden="true">
              <circle cx="5" cy="5" r="5" fill={group.color} />
            </svg>
            #{group.tag_prefix}
          </span>
        ))}
      </div>

      <div ref={liveRegionRef} aria-live="polite" className="sr-only" />

      {useCanvas ? (
        workerLoading ? (
          <div className="graph-loading">
            <span>{t('graph.computingLayout')}</span>
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
          aria-label={t('graph.ariaLabel')}
          onKeyDown={handleKeyDown}
        >
          <title>
            {t('graph.title')} — {t('graph.nodeCount', { count: graph.nodes.length })} · {t('graph.edgeCount', { count: graph.edges.length })}
          </title>
          <defs>
            <marker id="graph-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L7,3.5 L0,7 z" fill="var(--muted)" />
            </marker>
            <marker id="graph-arrow-wikilink" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L7,3.5 L0,7 z" fill="var(--primary)" />
            </marker>
          </defs>
          {graph.edges.map((edge) => {
            const source = nodeById.get(edge.source)
            const target = nodeById.get(edge.target)
            if (!source || !target) return null
            const dx = target.x - source.x
            const dy = target.y - source.y
            const distance = Math.hypot(dx, dy) || 1
            const ux = dx / distance
            const uy = dy / distance
            const nx = -uy
            const ny = ux
            const reciprocal = (reciprocalPairs.get(graphPairKey(edge.source, edge.target))?.size ?? 0) > 1
            const offset = reciprocal ? (edge.source < edge.target ? 5 : -5) : 0
            const targetRadius = target.path === focusPath ? 20 : 16
            const startX = source.x + nx * offset
            const startY = source.y + ny * offset
            const endX = target.x + nx * offset - ux * targetRadius
            const endY = target.y + ny * offset - uy * targetRadius
            return (
              <line
                key={edge.id}
                x1={startX}
                y1={startY}
                x2={endX}
                y2={endY}
                className={edge.kind === 'wikilink' ? 'graph-edge wikilink' : 'graph-edge'}
                markerEnd={edge.kind === 'wikilink' ? 'url(#graph-arrow-wikilink)' : 'url(#graph-arrow)'}
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
                transform={`translate(${node.x}, ${node.y})`}
                onMouseEnter={() => setHoveredId(node.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => {
                  if (node.path) onSelectNode(node.path)
                }}
                className={`${
                  node.unresolved
                    ? 'graph-node unresolved'
                    : isFocus
                      ? 'graph-node focus'
                      : 'graph-node'
                }${node.path ? ' graph-node-interactive' : ''}`}
                aria-label={`${node.label}, ${t('graph.connections', { count: connectionCount, plural: connectionCount === 1 ? '' : 's' })}${isFocus ? t('graph.currentFocus') : ''}`}
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
