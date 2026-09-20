function isE2EBuild(): boolean {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
  return env?.VITE_E2E_MODE === 'true'
}

export function isDesktopWindowRuntime(): boolean {
  // Browser E2E deliberately exposes a mock __TAURI_INTERNALS__ object so the
  // command bridge is exercised, but it is not a native window runtime. Native
  // window APIs such as getCurrentWindow() must never run in that environment.
  return typeof window !== 'undefined' && !isE2EBuild() && '__TAURI_INTERNALS__' in window
}

export function isTauriRuntime(): boolean {
  return isDesktopWindowRuntime() || import.meta.env.VITE_E2E_MODE === 'true'
}

export function isNativeBridgeAvailable(): boolean {
  return isTauriRuntime()
}
