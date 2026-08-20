const tauriCoreImportPattern = /(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"]@tauri-apps\/api\/core['"]/

export function importsTauriCore(source) {
  return tauriCoreImportPattern.test(source)
}
