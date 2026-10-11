declare module 'citeproc/citeproc_commonjs.js' {
  export interface CslEngine {
    updateItems(ids: string[]): void
    setOutputFormat(format: 'text' | 'html'): void
    previewCitationCluster(
      citation: { citationItems: Array<{ id: string; prefix?: string; suffix?: string; locator?: string; label?: string; 'suppress-author'?: boolean; 'author-only'?: boolean }>; properties?: { noteIndex: number } },
      citationsPre: unknown[],
      citationsPost: unknown[],
      outputFormat: 'text' | 'html',
    ): string
    makeBibliography(): [Record<string, unknown>, string[]]
  }

  export interface CslSys {
    retrieveLocale(lang: string): string | false
    retrieveItem(id: string): Record<string, unknown> | null | undefined
  }

  export default class CSL {
    static Engine: new (sys: CslSys, style: string) => CslEngine
  }
}
