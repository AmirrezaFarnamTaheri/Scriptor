import { LinkRewriteDialog } from './LinkRewriteDialog'
import type { LinkRewritePreview } from '../types/vault'

interface RenameTagDialogProps {
  oldTag: string
  preview: LinkRewritePreview | null
  isApplying: boolean
  onClose: () => void
  onPreview: (newTag: string) => void
  onApply: (newTag: string) => void
}

export function RenameTagDialog({
  oldTag,
  preview,
  isApplying,
  onClose,
  onPreview,
  onApply,
}: RenameTagDialogProps) {
  return (
    <LinkRewriteDialog
      title="Rename tag"
      subtitle={`Current tag #${oldTag}`}
      preview={preview}
      isApplying={isApplying}
      applyLabel="Rename tag"
      onClose={onClose}
      onPreview={() => {
        const input = document.querySelector<HTMLInputElement>('#rename-tag-input')
        const next = input?.value.trim() ?? ''
        if (!next) return
        onPreview(next)
      }}
      onApply={() => {
        const input = document.querySelector<HTMLInputElement>('#rename-tag-input')
        const next = input?.value.trim() ?? ''
        if (!next) return
        onApply(next)
      }}
    >
      <label>
        <span>New tag</span>
        <input id="rename-tag-input" name="newTag" defaultValue={oldTag} required />
      </label>
      <p className="health-subtitle">
        Hierarchical children like {oldTag}/child are renamed too.
      </p>
    </LinkRewriteDialog>
  )
}
