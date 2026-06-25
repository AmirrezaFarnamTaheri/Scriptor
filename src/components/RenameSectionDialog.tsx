import { LinkRewriteDialog } from './LinkRewriteDialog'
import type { LinkRewritePreview } from '../types/vault'

interface RenameSectionDialogProps {
  notePath: string
  oldSection: string
  preview: LinkRewritePreview | null
  isApplying: boolean
  onClose: () => void
  onPreview: (newSection: string, updateHeading: boolean) => void
  onApply: (newSection: string, updateHeading: boolean) => void
}

export function RenameSectionDialog({
  notePath,
  oldSection,
  preview,
  isApplying,
  onClose,
  onPreview,
  onApply,
}: RenameSectionDialogProps) {
  const readForm = () => {
    const input = document.querySelector<HTMLInputElement>('#rename-section-input')
    const updateHeading = document.querySelector<HTMLInputElement>('#rename-section-heading')
    return {
      next: input?.value.trim() ?? '',
      updateHeading: updateHeading?.checked ?? true,
    }
  }

  return (
    <LinkRewriteDialog
      title="Rename section"
      subtitle={`${notePath} · ${oldSection}`}
      preview={preview}
      isApplying={isApplying}
      applyLabel="Rename section"
      onClose={onClose}
      onPreview={() => {
        const { next, updateHeading } = readForm()
        if (!next) return
        onPreview(next, updateHeading)
      }}
      onApply={() => {
        const { next, updateHeading } = readForm()
        if (!next) return
        onApply(next, updateHeading)
      }}
    >
      <label>
        <span>New section label</span>
        <input id="rename-section-input" name="newSection" defaultValue={oldSection} required />
      </label>
      <label className="checkbox-row">
        <input id="rename-section-heading" name="updateHeading" type="checkbox" defaultChecked />
        <span>Update heading text and backlinks across the vault</span>
      </label>
    </LinkRewriteDialog>
  )
}
