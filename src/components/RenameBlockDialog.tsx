import { LinkRewriteDialog } from './LinkRewriteDialog'
import type { LinkRewritePreview } from '../types/vault'

interface RenameBlockDialogProps {
  notePath: string
  oldBlock: string
  preview: LinkRewritePreview | null
  isApplying: boolean
  onClose: () => void
  onPreview: (newBlock: string, updateAnchor: boolean) => void
  onApply: (newBlock: string, updateAnchor: boolean) => void
}

export function RenameBlockDialog({
  notePath,
  oldBlock,
  preview,
  isApplying,
  onClose,
  onPreview,
  onApply,
}: RenameBlockDialogProps) {
  const readForm = () => {
    const input = document.querySelector<HTMLInputElement>('#rename-block-input')
    const updateAnchor = document.querySelector<HTMLInputElement>('#rename-block-anchor')
    return {
      next: input?.value.trim() ?? '',
      updateAnchor: updateAnchor?.checked ?? true,
    }
  }

  return (
    <LinkRewriteDialog
      title="Rename block anchor"
      subtitle={`${notePath} · ${oldBlock}`}
      preview={preview}
      isApplying={isApplying}
      applyLabel="Rename block"
      onClose={onClose}
      onPreview={() => {
        const { next, updateAnchor } = readForm()
        if (!next) return
        onPreview(next, updateAnchor)
      }}
      onApply={() => {
        const { next, updateAnchor } = readForm()
        if (!next) return
        onApply(next, updateAnchor)
      }}
    >
      <label>
        <span>New block anchor</span>
        <input id="rename-block-input" name="newBlock" defaultValue={oldBlock} required />
      </label>
      <label className="checkbox-row">
        <input id="rename-block-anchor" name="updateAnchor" type="checkbox" defaultChecked />
        <span>Update wikilink block references across the vault</span>
      </label>
    </LinkRewriteDialog>
  )
}
