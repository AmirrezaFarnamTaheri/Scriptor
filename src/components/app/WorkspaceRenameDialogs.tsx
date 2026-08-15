import type { RenameTarget } from '../../hooks/useRenameDialogStore'
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
  const runWorkspaceOperation = (
    operation: string,
    promise: Promise<unknown>,
    onSuccess?: () => void,
  ) => {
    void promise
      .then(() => onSuccess?.())
      .catch((error) =>
        workspace.logActivity(
          'error',
          `${operation} failed`,
          error instanceof Error ? error.message : String(error),
        ),
      )
  }

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
          onPreview={(newTag) =>
            runWorkspaceOperation('Preview tag rename', workspace.previewTagRename(tag, newTag))
          }
          onApply={(newTag) =>
            runWorkspaceOperation('Apply tag rename', workspace.applyTagRename(tag, newTag), () => {
              setTag(null)
              closeKnowledgeWorkbench()
            })
          }
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
            runWorkspaceOperation(
              'Preview block rename',
              workspace.previewBlockRename(block.path, block.label, newBlock, updateAnchor),
            )
          }
          onApply={(newBlock, updateAnchor) =>
            runWorkspaceOperation(
              'Apply block rename',
              workspace.applyBlockRename(block.path, block.label, newBlock, updateAnchor),
              () => setBlock(null),
            )
          }
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
            runWorkspaceOperation(
              'Preview section rename',
              workspace.previewSectionRename(section.path, section.label, newSection, updateHeading),
            )
          }
          onApply={(newSection, updateHeading) =>
            runWorkspaceOperation(
              'Apply section rename',
              workspace.applySectionRename(section.path, section.label, newSection, updateHeading),
              () => setSection(null),
            )
          }
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
            runWorkspaceOperation(
              'Preview note rename',
              workspace.previewRename(toPath, updateLinks, notePath ?? undefined),
            )
          }
          onApply={(toPath, updateLinks) =>
            runWorkspaceOperation(
              'Apply note rename',
              workspace.applyRename(toPath, updateLinks, notePath ?? undefined),
              () => {
                setNoteOpen(false)
                setNotePath(null)
              },
            )
          }
        />
      ) : null}
    </>
  )
}
