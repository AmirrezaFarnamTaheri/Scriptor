export function generateSmallPreviewFixture(): string {
  const lines: string[] = ['# Small Document']
  for (let i = 0; i < 15; i += 1) {
    lines.push(`Paragraph ${i + 1}: Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore.`)
  }
  return lines.join('\n\n')
}

export function generateMediumPreviewFixture(): string {
  const lines: string[] = ['# Medium Document']
  for (let i = 0; i < 150; i += 1) {
    lines.push(`Paragraph ${i + 1}: Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation.`)
  }
  return lines.join('\n\n')
}

export function generateLargePreviewFixture(): string {
  const lines: string[] = ['# Large Document']
  for (let i = 0; i < 400; i += 1) {
    lines.push(`Paragraph ${i + 1}: Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.`)
  }
  lines.push('\n## Tables\n')
  for (let t = 0; t < 10; t += 1) {
    lines.push('| Col A | Col B | Col C | Col D | Col E |')
    lines.push('| ----- | ----- | ----- | ----- | ----- |')
    for (let r = 0; r < 20; r += 1) lines.push(`| cell-${t}-${r}-a | cell-${t}-${r}-b | cell-${t}-${r}-c | cell-${t}-${r}-d | cell-${t}-${r}-e |`)
    lines.push('')
  }
  lines.push('\n## Code Blocks\n')
  for (let i = 0; i < 20; i += 1) {
    lines.push('```typescript')
    lines.push(`function compute_${i}(x: number, y: number): number {`)
    lines.push(`  const result = x * y + ${i}`)
    lines.push('  return result')
    lines.push('}')
    lines.push('```')
  }
  lines.push('\n## Math\n')
  for (let i = 0; i < 15; i += 1) lines.push(`$$f_${i}(x) = \\int_0^x e^{-t^2} dt + \\sum_{n=1}^{\\infty} \\frac{\\sin(n\\pi x)}{n^2}$$`)
  return lines.join('\n')
}
