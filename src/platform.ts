export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || import.meta.env.VITE_E2E_MODE === 'true')
}

export function isNativeBridgeAvailable(): boolean {
  return isTauriRuntime()
}
