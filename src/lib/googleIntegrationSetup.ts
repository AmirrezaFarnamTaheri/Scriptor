/** Include aliases and manual/shared resources without losing the saved selection. */
export function googleResourceOptions(
  alias: string,
  aliasLabel: string,
  selected: string,
  discovered: Array<{ id: string; label: string }>,
): Array<{ id: string; label: string }> {
  const choices = new Map<string, { id: string; label: string }>([[alias, { id: alias, label: aliasLabel }]])
  for (const resource of discovered) {
    if (!choices.has(resource.id)) choices.set(resource.id, resource)
  }
  if (selected && !choices.has(selected)) choices.set(selected, { id: selected, label: selected })
  return [...choices.values()]
}

/** A public client ID can be shared without replacing any provider binding. */
export function mergeGoogleClientId<T extends { calendar_sync?: object }>(current: T, clientId: string): T & {
  calendar_sync: NonNullable<T['calendar_sync']> & { google_client_id: string | null }
} {
  return { ...current, calendar_sync: { ...current.calendar_sync, google_client_id: clientId.trim() || null } } as T & {
    calendar_sync: NonNullable<T['calendar_sync']> & { google_client_id: string | null }
  }
}
