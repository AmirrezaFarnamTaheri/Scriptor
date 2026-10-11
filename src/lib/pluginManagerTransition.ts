/** Keep the registry authority ahead of the module preference write. */
export async function applyPluginManagerTransition(
  id: string,
  enabled: boolean,
  authorize: ((id: string, enabled: boolean) => Promise<boolean>) | undefined,
  persist: (enabled: boolean) => Promise<void>,
): Promise<boolean> {
  if (authorize && !await authorize(id, enabled)) return false
  await persist(enabled)
  return true
}
