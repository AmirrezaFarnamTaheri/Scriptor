import { vaultAppendStatsHistory } from '../bridge/commands'
import { isNativeBridgeAvailable } from '../bridge/platform'

import { formatLocalDate } from '@scriptor/core/date'

export function recordWritingSession(words: number): void {
  if (!isNativeBridgeAvailable() || words <= 0) return
  const today = formatLocalDate()
  void vaultAppendStatsHistory(today, words)
}
