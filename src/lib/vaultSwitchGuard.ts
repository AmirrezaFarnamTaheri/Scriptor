export interface VaultSwitchDetail { waitUntil(promise: Promise<unknown>): void }

/** A source workspace may finish a save or ask about its dirty draft before the
 * native vault changes. Any refusal or failed persistence leaves the vault open. */
export async function prepareVaultSwitch(target: EventTarget = window): Promise<boolean> {
  const pending: Promise<unknown>[] = []
  const detail: VaultSwitchDetail = { waitUntil: promise => { pending.push(Promise.resolve(promise)) } }
  target.dispatchEvent(new CustomEvent<VaultSwitchDetail>('scriptor:vault-change-starting', { detail }))
  const results = await Promise.allSettled(pending)
  return results.every(result => result.status === 'fulfilled' && result.value !== false)
}
