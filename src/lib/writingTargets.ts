import { vaultAppendStatsHistory } from '../bridge/commands'
import { isNativeBridgeAvailable } from '../bridge/platform'

export function recordWritingSession(words: number): void {
  if (!isNativeBridgeAvailable() || words <= 0) return
  const today = new Date().toISOString().slice(0, 10)
  void vaultAppendStatsHistory(today, words)
}
