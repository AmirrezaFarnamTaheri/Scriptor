import { invoke } from '@tauri-apps/api/core'

import { isNativeBridgeAvailable } from './platform'

export function requireNative(): void {
  if (!isNativeBridgeAvailable()) {
    throw new Error('Native commands are only available in the Scriptor desktop app. Run `pnpm desktop:dev`.')
  }
}

export async function nativeInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  requireNative()
  return invoke<T>(command, args)
}
