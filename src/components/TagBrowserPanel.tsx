import { useEffect, useMemo, useState } from 'react'
import { Tags, X } from 'lucide-react'

import { indexerListTags, indexerNotesForTag } from '../bridge/commands'
import { isNativeBridgeAvailable } from '../bridge/platform'
import { useEscapeToClose } from '../hooks/useEscapeToClose'
import type { TaggedNote, TagSummary } from '../types/vault'

interface TagNode {
  label: string
  fullTag: string | null
  count: number
  children: TagNode[]
}

function buildTagTree(tags: TagSummary[]): TagNode[] {
  const root: TagNode[] = []

  for (const entry of tags) {
    const parts = entry.tag.split('/')
    let level = root

    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index]
      const fullTag = index === parts.length - 1 ? entry.tag : null
      const existing = level.find((node) => node.label === part)

      if (existing) {
        if (fullTag) existing.count += entry.note_count
        if (existing.fullTag === null && fullTag) existing.fullTag = fullTag
        level = existing.children
      } else {
        const node: TagNode = {
          label: part,
          fullTag,
          count: fullTag ? entry.note_count : 0,
          children: [],
        }
        level.push(node)
        level = node.children
      }
    }
  }

  const sortNodes = (nodes: TagNode[]): TagNode[] =>
    nodes
      .map((node) => ({ ...node, children: sortNodes(node.children) }))
      .sort((left, right) => left.label.localeCompare(right.label))

  return sortNodes(root)
}

function TagTree({
  nodes,
  depth,
  selectedTag,
  onSelect,
}: {
  nodes: TagNode[]
  depth: number
  selectedTag: string | null
  onSelect: (tag: string) => void
}) {
  return (
    <ul className="tag-tree" style={{ paddingLeft: depth > 0 ? 12 : 0 }}>
      {nodes.map((node) => (
        <li key={`${depth}-${node.label}-${node.fullTag ?? 'group'}`}>
          {node.fullTag ? (
            <button
              type="button"
              className={selectedTag === node.fullTag ? 'active' : ''}
              onClick={() => onSelect(node.fullTag!)}
            >
              <Tags />
              <span>#{node.fullTag}</span>
              <small>{node.count}</small>
            </button>
          ) : (
            <div className="tag-group-label">
              <span>{node.label}</span>
            </div>
          )}
          {node.children.length > 0 && (
            <TagTree nodes={node.children} depth={depth + 1} selectedTag={selectedTag} onSelect={onSelect} />
          )}
        </li>
      ))}
    </ul>
  )
}

interface TagBrowserPanelProps {
  embedded?: boolean
  vaultOpen: boolean
  onClose: () => void
  onInsertTag: (tag: string) => void
  onOpenNote: (path: string) => void
  onRenameTag?: (tag: string) => void
}

export function TagBrowserPanel({
  embedded = false,
  vaultOpen,
  onClose,
  onInsertTag,
  onOpenNote,
  onRenameTag,
}: TagBrowserPanelProps) {
  const canBrowse = vaultOpen && isNativeBridgeAvailable()
  const [tags, setTags] = useState<TagSummary[]>([])
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [taggedNotes, setTaggedNotes] = useState<TaggedNote[]>([])
  const [loadStatus, setLoadStatus] = useState('Loading tags…')

  useEscapeToClose(!embedded, onClose)

  const status = useMemo(() => {
    if (!canBrowse) return 'Open a vault in the desktop app to browse tags.'
    return loadStatus
  }, [canBrowse, loadStatus])

  useEffect(() => {
    if (!canBrowse) return

    let cancelled = false
    void (async () => {
      try {
        const summaries = await indexerListTags()
        if (cancelled) return
        setTags(summaries)
        setLoadStatus(summaries.length === 0 ? 'No tags indexed yet.' : `${summaries.length} tags`)
      } catch (error) {
        if (!cancelled) {
          setLoadStatus(error instanceof Error ? error.message : 'Could not load tags')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [canBrowse])

  useEffect(() => {
    if (!canBrowse || !selectedTag) return

    let cancelled = false
    void (async () => {
      try {
        const notes = await indexerNotesForTag(selectedTag)
        if (!cancelled) setTaggedNotes(notes)
      } catch {
        if (!cancelled) setTaggedNotes([])
      }
    })()

    return () => {
      cancelled = true
    }
  }, [canBrowse, selectedTag])

  const visibleTaggedNotes = selectedTag ? taggedNotes : []
  const tagTree = useMemo(() => buildTagTree(tags), [tags])

  const body = (
    <>
      {embedded ? <p className="health-subtitle">{status}</p> : null}

      <div className="tag-browser-body">
          <div className="tag-list">
            {tagTree.length === 0 ? (
              <p className="empty-state">No tags indexed yet.</p>
            ) : (
              <TagTree nodes={tagTree} depth={0} selectedTag={selectedTag} onSelect={setSelectedTag} />
            )}
          </div>

          <div className="tag-notes">
            {selectedTag ? (
              <>
                <div className="tag-notes-header">
                  <strong>#{selectedTag}</strong>
                  <div className="tag-notes-actions">
                    <button type="button" className="toolbar-button" onClick={() => onInsertTag(selectedTag)}>
                      Insert tag
                    </button>
                    {onRenameTag ? (
                      <button type="button" className="toolbar-button" onClick={() => onRenameTag(selectedTag)}>
                        Rename tag
                      </button>
                    ) : null}
                  </div>
                </div>
                <ul className="dock-list">
                  {visibleTaggedNotes.length === 0 ? (
                    <li className="empty-state">No notes with this tag.</li>
                  ) : (
                    visibleTaggedNotes.map((note) => (
                      <li key={note.path}>
                        <button type="button" onClick={() => onOpenNote(note.path)}>
                          <strong>{note.title}</strong>
                          <span>{note.path}</span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </>
            ) : (
              <p className="empty-state">Select a tag to see matching notes.</p>
            )}
          </div>
        </div>
    </>
  )

  if (embedded) {
    return <div className="knowledge-workbench-embed">{body}</div>
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section className="tag-browser-panel" role="dialog" aria-label="Tag browser" onClick={(event) => event.stopPropagation()}>
        <header>
          <div>
            <h2>Tag browser</h2>
            <p className="health-subtitle">{status}</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close tag browser">
            <X />
          </button>
        </header>
        {body}
      </section>
    </div>
  )
}
