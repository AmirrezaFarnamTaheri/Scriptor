import type { SnippetCatalogEntry } from './snippet-catalog.ts'

export const MERMAID_SNIPPETS: SnippetCatalogEntry[] = [
  {
    name: 'mermaid-flowchart',
    description: 'Mermaid flowchart',
    content: '```mermaid\nflowchart TD\n    A[Start] --> B{Decision}\n    B -->|Yes| C[Done]\n    B -->|No| D[Retry]\n```\n',
  },
  {
    name: 'mermaid-sequence',
    description: 'Mermaid sequence diagram',
    content: '```mermaid\nsequenceDiagram\n    participant A as Alice\n    participant B as Bob\n    A->>B: Hello\n    B-->>A: Hi\n```\n',
  },
  {
    name: 'mermaid-class',
    description: 'Mermaid class diagram',
    content: '```mermaid\nclassDiagram\n    class Animal {\n        +name: string\n        +speak()\n    }\n    class Dog {\n        +breed: string\n    }\n    Animal <|-- Dog\n```\n',
  },
  {
    name: 'mermaid-gantt',
    description: 'Mermaid Gantt chart',
    content: '```mermaid\ngantt\n    title Project Timeline\n    dateFormat YYYY-MM-DD\n    section Phase 1\n    Research :a1, 2026-01-01, 7d\n    Design    :a2, after a1, 5d\n```\n',
  },
]

export const MATH_SNIPPETS: SnippetCatalogEntry[] = [
  {
    name: 'math-inline',
    description: 'Inline math ($...$)',
    content: '$${1:equation}$',
  },
  {
    name: 'math-block',
    description: 'Block math ($$...$$)',
    content: '$$\n${1:equation}\n$$\n',
  },
]
