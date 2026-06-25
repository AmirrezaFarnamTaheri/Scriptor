/** MPE-style block math fences: ` ```math ` */

const MATH_FENCE = /```math[^\n]*\n([\s\S]*?)```/gi

/** Convert ` ```math ` fences to `$$` blocks for remark-math. */
export function preprocessMathFences(markdown: string): string {
  return markdown.replace(MATH_FENCE, (_match, body: string) => `\n$$\n${body.trim()}\n$$\n`)
}
