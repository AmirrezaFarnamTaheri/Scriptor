export function wrapSelectionText(text: string, prefix: string, suffix = prefix): string {
  return `${prefix}${text}${suffix}`
}

export function unwrapSelectionText(
  text: string,
  before: string,
  after: string,
  prefix: string,
  suffix = prefix,
): string | null {
  if (before === prefix && after === suffix) {
    return text
  }
  return null
}

export function prefixHeadingLine(line: string, level: 1 | 2 | 3): string {
  const marker = '#'.repeat(level)
  const prefixed = `${marker} `
  if (line.startsWith(`${marker} `)) {
    return line
  }
  return `${prefixed}${line.replace(/^#+\s*/, '')}`
}

export function prefixBlockquoteLine(line: string): string {
  return line.startsWith('> ') ? line : `> ${line}`
}

export interface TableBlock {
  startLine: number
  endLine: number
  rows: string[][]
}

export function isTableRow(line: string): boolean {
  const trimmed = line.trim()
  return trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.includes('|')
}

export function isTableSeparator(line: string): boolean {
  if (!isTableRow(line)) {
    return false
  }
  const cells = parseTableRow(line)
  return cells.length > 0 && cells.every((cell) => /^:?-+:?$/.test(cell))
}

export function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

export function findTableBlock(lines: string[], lineIndex: number): TableBlock | null {
  if (lineIndex < 0 || lineIndex >= lines.length) return null
  if (!isTableRow(lines[lineIndex]) && !isTableSeparator(lines[lineIndex])) {
    return null
  }

  let start = lineIndex
  while (start > 0 && (isTableRow(lines[start - 1]) || isTableSeparator(lines[start - 1]))) {
    start -= 1
  }

  let end = lineIndex
  while (end + 1 < lines.length && (isTableRow(lines[end + 1]) || isTableSeparator(lines[end + 1]))) {
    end += 1
  }

  const rows: string[][] = []
  for (let index = start; index <= end; index += 1) {
    if (!isTableSeparator(lines[index])) {
      rows.push(parseTableRow(lines[index]))
    }
  }

  if (rows.length === 0) return null
  return { startLine: start, endLine: end, rows }
}

export function formatTableRow(cells: string[]): string {
  return `| ${cells.join(' | ')} |`
}

export function addTableRow(block: TableBlock): string[][] {
  const columnCount = block.rows[0]?.length ?? 2
  const blankRow = Array.from({ length: columnCount }, () => '')
  return [...block.rows, blankRow]
}

export function addTableColumn(block: TableBlock): string[][] {
  return block.rows.map((row) => [...row, ''])
}

export function rebuildTableSegment(
  originalLines: string[],
  block: TableBlock,
  rows: string[][],
): string[] {
  const segment = originalLines.slice(block.startLine, block.endLine + 1)
  const separatorLine = segment.find((line) => isTableSeparator(line))
  const formatted = rows.map((row) => formatTableRow(row))
  if (separatorLine && formatted.length > 1) {
    return [formatted[0], separatorLine, ...formatted.slice(1)]
  }
  return formatted
}

export function updateTableCell(
  block: TableBlock,
  rowIndex: number,
  columnIndex: number,
  value: string,
): string[][] {
  return block.rows.map((row, rowIdx) =>
    row.map((cell, columnIdx) => (rowIdx === rowIndex && columnIdx === columnIndex ? value : cell)),
  )
}

export function collectTableBlocks(lines: string[]): TableBlock[] {
  const blocks: TableBlock[] = []
  const seen = new Set<number>()

  for (let index = 0; index < lines.length; index += 1) {
    if (seen.has(index)) {
      continue
    }
    if (!isTableRow(lines[index]) && !isTableSeparator(lines[index])) {
      continue
    }
    const block = findTableBlock(lines, index)
    if (!block || seen.has(block.startLine)) {
      continue
    }
    seen.add(block.startLine)
    for (let line = block.startLine; line <= block.endLine; line += 1) {
      seen.add(line)
    }
    blocks.push(block)
  }

  return blocks
}

export function tableBlockHasHeader(lines: string[], block: TableBlock): boolean {
  const separatorIndex = block.startLine + 1
  return separatorIndex <= block.endLine && isTableSeparator(lines[separatorIndex])
}

export function applyTableMutation(
  lines: string[],
  lineIndex: number,
  mutate: (block: TableBlock) => string[][],
): string[] | null {
  const block = findTableBlock(lines, lineIndex)
  if (!block) return null
  const nextRows = mutate(block)
  const segment = rebuildTableSegment(lines, block, nextRows)
  const next = [...lines]
  next.splice(block.startLine, block.endLine - block.startLine + 1, ...segment)
  return next
}
