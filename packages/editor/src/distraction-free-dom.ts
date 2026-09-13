export function setDistractionFreeClass(enabled: boolean): void {
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('scriptor-distraction-free', enabled)
  }
}
