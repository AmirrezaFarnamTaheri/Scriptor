export interface MarkdownVisualBlockRenderRequest {
  /** The complete fenced Markdown block, including its opening and closing fences. */
  raw: string
  /** The source inside the fence, without fence markers. */
  source: string
  /** Normalized info-string language, or an empty string when omitted. */
  language: string
  /** The remaining info-string metadata after the language. */
  meta: string
  from: number
  to: number
}

export type MarkdownVisualBlockRenderer = (
  request: MarkdownVisualBlockRenderRequest,
  container: HTMLElement,
) => void | Promise<void>
