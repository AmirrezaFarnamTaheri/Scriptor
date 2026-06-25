# Test Fixtures

Owner: Quality Engineering.

Fixtures preserve behavior from source systems without importing whole projects.

## Categories

- Markdown round-trip (`markdown/roundtrip/`)
- Wikilinks and backlinks (`markdown/wikilinks/`)
- Rename/link integrity (`markdown/rename/`)
- Citations and export profiles (`vaults/`)
- **Hostile Markdown sanitizer cases** (`markdown/hostile/`) — script tags, `javascript:` URLs, iframes, data URIs; validated by `packages/renderer/src/validate-runner.ts`
- Git conflict states (`git/`)
- MCP permission modes (`mcp/`)

## Hostile fixtures

| File | Threat model |
|------|----------------|
| `script-tag.md` | Inline `<script>` injection |
| `onclick.md` | `javascript:` href and `onerror` handlers |
| `iframe.md` | Embedded iframe |
| `data-uri.md` | `data:` URI in links |

All must render without executable HTML after `rehype-sanitize`.
