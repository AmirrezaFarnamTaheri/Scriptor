let headlessEnabled = false

export function setHeadlessMode(enabled: boolean) {
  headlessEnabled = enabled
}

export function isHeadlessMode(): boolean {
  return headlessEnabled
}
