export type VaultSwitchWait = Promise<unknown> | (() => Promise<unknown>)
export interface VaultSwitchDetail { waitUntil(wait: VaultSwitchWait): void }

/** A source workspace may finish a save or ask about its dirty draft before the
 * native vault changes. Any refusal or failed persistence leaves the vault open. */
export async function prepareVaultSwitch(target: EventTarget = window): Promise<boolean> {
  const pending: Array<() => Promise<boolean>> = []
  const observe = (promise: Promise<unknown>): Promise<boolean> => Promise.resolve(promise).then(value => value !== false, () => false)
  const detail: VaultSwitchDetail = { waitUntil: wait => {
    if (typeof wait === 'function') pending.push(async () => { try { return await observe(wait()) } catch { return false } })
    else {
      // Observe already-running listeners immediately, even if an earlier
      // deferred decision refuses and their result is never awaited.
      const result = observe(wait)
      pending.push(() => result)
    }
  } }
  target.dispatchEvent(new CustomEvent<VaultSwitchDetail>('scriptor:vault-change-starting', { detail }))
  for (const wait of pending) if (!(await wait())) return false
  return true
}
