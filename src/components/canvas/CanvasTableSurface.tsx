import { useMemo } from 'react'

interface TablePayload {
  rows: string[][]
}

function parseTableContent(contentRef: string): TablePayload {
  if (!contentRef.trim()) {
    return { rows: Array.from({ length: 3 }, () => ['', '', '']) }
  }
  try {
    const parsed = JSON.parse(contentRef) as TablePayload
    if (!Array.isArray(parsed.rows) || parsed.rows.length === 0) {
      return { rows: Array.from({ length: 3 }, () => ['', '', '']) }
    }
    return parsed
  } catch {
    return { rows: Array.from({ length: 3 }, () => ['', '', '']) }
  }
}

interface CanvasTableSurfaceProps {
  contentRef: string
  onChange: (contentRef: string) => void
}

export function CanvasTableSurface({ contentRef, onChange }: CanvasTableSurfaceProps) {
  const table = useMemo(() => parseTableContent(contentRef), [contentRef])

  const updateCell = (rowIndex: number, columnIndex: number, value: string) => {
    const rows = table.rows.map((row, index) =>
      index === rowIndex ? row.map((cell, col) => (col === columnIndex ? value : cell)) : [...row],
    )
    onChange(JSON.stringify({ rows }))
  }

  const addRow = () => {
    const columns = table.rows[0]?.length ?? 3
    onChange(JSON.stringify({ rows: [...table.rows, Array.from({ length: columns }, () => '')] }))
  }

  const addColumn = () => {
    onChange(JSON.stringify({ rows: table.rows.map((row) => [...row, '']) }))
  }

  return (
    <div className="canvas-table-surface" onPointerDown={(event) => event.stopPropagation()}>
      <table>
        <thead>
          <tr>
            {table.rows[0]?.map((cell, columnIndex) => (
              <th key={`head-${columnIndex}`}>
                <input
                  type="text"
                  value={cell}
                  onChange={(event) => updateCell(0, columnIndex, event.target.value)}
                  aria-label={`Header ${columnIndex + 1}`}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.slice(1).map((row, rowIndex) => (
            <tr key={`row-${rowIndex + 1}`}>
              {row.map((cell, columnIndex) => (
                <td key={`cell-${rowIndex + 1}-${columnIndex}`}>
                  <input
                    type="text"
                    value={cell}
                    onChange={(event) => updateCell(rowIndex + 1, columnIndex, event.target.value)}
                    aria-label={`Cell ${rowIndex + 2}, ${columnIndex + 1}`}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="canvas-table-actions">
        <button type="button" onClick={addRow}>
          Row
        </button>
        <button type="button" onClick={addColumn}>
          Column
        </button>
      </div>
    </div>
  )
}
