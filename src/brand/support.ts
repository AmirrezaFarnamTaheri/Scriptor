export const GITHUB_REPO = 'AmirrezaFarnamTaheri/Scriptor' as const
export const GITHUB_REPO_URL = `https://github.com/${GITHUB_REPO}` as const
export const GITHUB_STARS_URL = `${GITHUB_REPO_URL}/stargazers` as const
export const GITHUB_ISSUES_URL = `${GITHUB_REPO_URL}/issues` as const

export const MAINTAINER_NAME = 'Amirreza "Farnam" Taheri' as const
export const MAINTAINER_EMAIL = 'taherifarnam@gmail.com' as const

export const DONATION_WALLETS = {
  btc: 'bc1q68g4m4denjw4smhvwmnz5fychuj3ge2vupx07w',
  eth: '0xbd5af5d1517317111db9523d6bb42fceae887abb',
  tron: 'TRjFLA1Dd32Bw1i3FxjZW5dmVub5UfXFSS',
} as const

export const EDITOR_FONT_FAMILIES = [
  { id: 'jetbrains-mono', label: 'JetBrains Mono', css: '"JetBrains Mono", ui-monospace, monospace' },
  { id: 'inter', label: 'Inter', css: 'Inter, system-ui, sans-serif' },
  { id: 'system-ui', label: 'System UI', css: 'system-ui, -apple-system, Segoe UI, sans-serif' },
  { id: 'serif', label: 'Source Serif', css: '"Source Serif 4", Georgia, serif' },
  { id: 'mono', label: 'System monospace', css: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
] as const

export type EditorFontFamilyId = (typeof EDITOR_FONT_FAMILIES)[number]['id']

export function editorFontFamilyCss(id: EditorFontFamilyId): string {
  return EDITOR_FONT_FAMILIES.find((entry) => entry.id === id)?.css ?? EDITOR_FONT_FAMILIES[0].css
}
