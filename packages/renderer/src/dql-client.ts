export interface DqlResultRow {
  path: string
  title: string
  snippet: string
}

function renderTable(rows: DqlResultRow[]): HTMLTableElement {
  const table = document.createElement('table')
  table.className = 'dql-results-table'
  const thead = document.createElement('thead')
  const headerRow = document.createElement('tr')
  for (const label of ['Title', 'Path', 'Snippet']) {
    const th = document.createElement('th')
    th.textContent = label
    headerRow.appendChild(th)
  }
  thead.appendChild(headerRow)
  table.appendChild(thead)

  const tbody = document.createElement('tbody')
  for (const row of rows) {
    const tr = document.createElement('tr')
    for (const value of [row.title, row.path, row.snippet || '—']) {
      const td = document.createElement('td')
      td.textContent = value
      tr.appendChild(td)
    }
    tbody.appendChild(tr)
  }
  table.appendChild(tbody)
  return table
}

export async function hydrateDqlBlocks(
  root: HTMLElement,
  executeDql: (query: string) => Promise<DqlResultRow[]>,
): Promise<void> {
  const blocks = root.querySelectorAll<HTMLElement>('[data-dql-query], .dql-block[data-dql-query]')
  if (blocks.length === 0) return

  for (const block of blocks) {
    const query = block.getAttribute('data-dql-query')?.trim()
    if (!query) continue
    const format = block.getAttribute('data-dql-format')?.trim().toLowerCase() ?? 'list'
    try {
      const rows = await executeDql(query)
      if (format === 'table') {
        block.replaceChildren(renderTable(rows))
        continue
      }

      const list = document.createElement('ul')
      list.className = 'dql-results'
      if (rows.length === 0) {
        const empty = document.createElement('li')
        empty.textContent = 'No results'
        list.appendChild(empty)
      } else {
        for (const row of rows) {
          const item = document.createElement('li')
          const snippet = row.snippet ? ` — ${row.snippet}` : ''
          item.textContent = `${row.title} (${row.path})${snippet}`
          list.appendChild(item)
        }
      }
      block.replaceChildren(list)
    } catch (error) {
      const message = document.createElement('p')
      message.className = 'dql-error'
      message.textContent = error instanceof Error ? error.message : 'DQL query failed'
      block.replaceChildren(message)
    }
  }
}
