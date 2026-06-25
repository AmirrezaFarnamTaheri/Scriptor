declare module 'citeproc/citeproc_commonjs.js' {
  export interface CslEngine {
    updateItems(ids: string[]): void
    previewCitationCluster(
      citation: { citationItems: Array<{ id: string }> },
      citationsPre: unknown[],
      pos: number,
    ): [number, string, string]
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
