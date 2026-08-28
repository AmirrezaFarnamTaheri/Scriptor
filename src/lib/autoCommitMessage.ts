/** Build a descriptive Git commit message from changed vault paths (Tolaria-style helper). */
import { formatLocalDate } from '@scriptor/core/date'

export function buildAutoCommitMessage(changedPaths: string[]): string {
  const date = formatLocalDate()
  if (changedPaths.length === 0) {
    return `Update vault notes (${date})`
  }
  if (changedPaths.length === 1) {
    return `Update ${changedPaths[0]} (${date})`
  }
  const basenames = changedPaths.map((path) => path.split('/').pop() ?? path)
  if (changedPaths.length <= 3) {
    return `Update ${basenames.join(', ')} (${date})`
  }
  return `Update ${changedPaths.length} notes (${date})`
}
