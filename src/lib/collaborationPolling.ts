export const MAX_POLL_REQUESTS = 90
/** Explicit sessions never renew themselves; failures consume the same budget. */
export function pollingDelay(failures: number): number {
  return Math.min(300_000, 10_000 * 2 ** Math.min(4, Math.max(0, failures)))
}
