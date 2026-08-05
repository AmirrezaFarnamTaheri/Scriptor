import type { RenameTarget } from '../../hooks/useAppOverlayState'
import type { useVaultWorkspace } from '../../hooks/useVaultWorkspace'
import { RenameBlockDialog } from '../RenameBlockDialog'
import { RenameNoteDialog } from '../RenameNoteDialog'
import { RenameSectionDialog } from '../RenameSectionDialog'
import { RenameTagDialog } from '../RenameTagDialog'

type VaultWorkspace = ReturnType<typeof useVaultWorkspace>

interface WorkspaceRenameDialogsProps {
  workspace: VaultWorkspace
  tag: string | null
  block: RenameTarget | null
  section: RenameTarget | null
  noteOpen: boolean
  notePath: string | null
  setTag: (value: string | null) => void
  setBlock: (value: RenameTarget | null) => void
  setSection: (value: RenameTarget | null) => void
  setNoteOpen: (value: boolean) => void
  setNotePath: (value: string | null) => void
  closeKnowledgeWorkbench: () => void
}

/** Owns the four rename transactions and their preview/cleanup lifecycle. */
export function WorkspaceRenameDialogs({
  workspace,
  tag,
  block,
  section,
  noteOpen,
  notePath,
  setTag,
  setBlock,
  setSection,
  setNoteOpen,
  setNotePath,
  closeKnowledgeWorkbench,
}: WorkspaceRenameDialogsProps) {
  return (
    <>
      {tag ? (
        <RenameTagDialog
          oldTag={tag}
          preview={workspace.linkRewritePreview}
          isApplying={workspace.isLinkRewriting}
          onClose={() => {
            setTag(null)
            workspace.clearLinkRewritePreview()
          }}
          onPreview={(newTag) => void workspace.previewTagRename(tag, newTag)}
          onApply={(newTag) => {
            void workspace.applyTagRename(tag, newTag).then(() => {
              setTag(null)
              closeKnowledgeWorkbench()
            })
          }}
        />
      ) : null}

      {block ? (
        <RenameBlockDialog
          notePath={block.path}
          oldBlock={block.label}
          preview={workspace.linkRewritePreview}
          isApplying={workspace.isLinkRewriting}
          onClose={() => {
            setBlock(null)
            workspace.clearLinkRewritePreview()
          }}
          onPreview={(newBlock, updateAnchor) =>
            void workspace.previewBlockRename(block.path, block.label, newBlock, updateAnchor)
          }
          onApply={(newBlock, updateAnchor) => {
            void workspace
              .applyBlockRename(block.path, block.label, newBlock, updateAnchor)
              .then(() => setBlock(null))
          }}
        />
      ) : null}

      {section ? (
        <RenameSectionDialog
          notePath={section.path}
          oldSection={section.label}
          preview={workspace.linkRewritePreview}
          isApplying={workspace.isLinkRewriting}
          onClose={() => {
            setSection(null)
            workspace.clearLinkRewritePreview()
          }}
          onPreview={(newSection, updateHeading) =>
            void workspace.previewSectionRename(section.path, section.label, newSection, updateHeading)
          }
          onApply={(newSection, updateHeading) => {
            void workspace
              .applySectionRename(section.path, section.label, newSection, updateHeading)
              .then(() => setSection(null))
          }}
        />
      ) : null}

      {noteOpen && (notePath ?? workspace.activePath) ? (
        <RenameNoteDialog
          currentPath={notePath ?? workspace.activePath ?? ''}
          preview={workspace.renamePreview}
          isApplying={workspace.isRenaming}
          onClose={() => {
            setNoteOpen(false)
            setNotePath(null)
            workspace.clearRenamePreview()
          }}
          onPreview={(toPath, updateLinks) =>
            void workspace.previewRename(toPath, updateLinks, notePath ?? undefined)
          }
          onApply={(toPath, updateLinks) => {
            void workspace.applyRename(toPath, updateLinks, notePath ?? undefined).then(() => {
              setNoteOpen(false)
              setNotePath(null)
            })
          }}
        />
      ) : null}
    </>
  )
}
