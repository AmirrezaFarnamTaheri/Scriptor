# i18n Framework

## Status

- **Phase**: D — Strategic Expansion
- **Priority**: Low-Medium

## Current State

Scriptor is **English-only**. All UI strings are hardcoded:

```tsx
// Current pattern in renderer
<Button>Save Note</Button>
<span>No results found</span>
```

**Problems**:
- No locale switching
- Hardcoded date/number formats
- Tauri commands return English-only error messages
- CLI help text is English-only

## Approach

### Option A: i18next + react-i18next

- **Maturity**: Industry standard, ~20M weekly npm downloads
- **Ecosystem**: Rich — ICU plugins, plurals, context, interpolation
- **Bundle**: ~15 KB gzipped
- **Integration**: React hooks (`useTranslation`), HOC, Suspense

### Option B: ICU MessageFormat (via `@formatjs/intl`)

- **Maturity**: ECMA-402 aligned, ICU standard
- **Ecosystem**: FormatJS suite — `react-intl`, `intl-messageformat`
- **Bundle**: ~20 KB gzipped
- **Integration**: React hooks, provider pattern

### Option C: Custom lightweight solution

- **Maturity**: N/A
- **Bundle**: ~3 KB
- **Integration**: Direct

### Recommendation

**i18next** — largest ecosystem, best React integration, mature plural/gender rules, easy onboarding for contributors.

## Locale Pack Structure

```
packages/renderer/src/locales/
├── en/
│   ├── common.json          # shared UI strings
│   ├── editor.json           # editor-specific
│   ├── settings.json         # settings panel
│   ├── commands.json         # command palette
│   └── errors.json           # error messages
├── de/
│   ├── common.json
│   ├── editor.json
│   └── ...
├── ja/
│   └── ...
├── zh-CN/
│   └── ...
└── index.ts                  # locale registration
```

### Example locale file

```json
// packages/renderer/src/locales/en/common.json
{
  "app": {
    "name": "Scriptor",
    "tagline": "Your knowledge, beautifully organized"
  },
  "actions": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "create": "Create",
    "search": "Search",
    "open": "Open"
  },
  "notes": {
    "untitled": "Untitled",
    "empty": "No notes yet. Create your first note to get started.",
    "count": "{{count}} note",
    "count_plural": "{{count}} notes",
    "modified": "Modified {{date, relative}}",
    "created": "Created {{date, datetime}}"
  },
  "search": {
    "placeholder": "Search notes...",
    "noResults": "No results found for \"{{query}}\"",
    "resultCount": "{{count}} result",
    "resultCount_plural": "{{count}} results"
  }
}
```

### Locale file conventions

- Keys use `camelCase`
- Nested by feature domain
- Plurals use `_plural` suffix (i18next convention)
- Interpolation uses `{{variable}}`
- Date/time uses `{{date, datetime}}` or `{{date, relative}}`

## Integration Points

### 1. React Components

```tsx
// packages/renderer/src/hooks/useI18n.ts
import { useTranslation } from 'react-i18next'

export function useI18n(namespace = 'common') {
  return useTranslation(namespace)
}

// Usage in component
function NoteCard({ note }: { note: Note }) {
  const { t } = useI18n()
  return (
    <div>
      <h3>{note.title || t('notes.untitled')}</h3>
      <span>{t('notes.modified', { date: note.modifiedAt })}</span>
    </div>
  )
}
```

### 2. Tauri Commands

```rust
// crates/daemon/src/locale.rs
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocaleMessage {
    pub key: String,
    pub params: Option<serde_json::Value>,
}

// Error messages return locale keys, not English strings
#[derive(Debug, Serialize)]
pub struct LocalizedError {
    pub code: String,
    pub message_key: String,      // e.g., "errors.noteNotFound"
    pub message_params: Option<serde_json::Value>,
    pub fallback: String,          // English fallback for logging
}

// command_gateway error handling
fn localized_error(code: &str, key: &str, params: Option<Value>, fallback: &str) -> Value {
    json!(LocalizedError {
        code: code.to_string(),
        message_key: key.to_string(),
        message_params: params,
        fallback: fallback.to_string(),
    })
}
```

### 3. CLI

```rust
// crates/cli/src/locale.rs
use std::collections::HashMap;

pub struct CliLocale {
    messages: HashMap<String, String>,
}

impl CliLocale {
    pub fn load(lang: &str) -> Self {
        // Load from embedded JSON or ~/.config/scriptor/locales/
        let data = match lang {
            "de" => include_str!("../locales/de/cli.json"),
            "ja" => include_str!("../locales/ja/cli.json"),
            _ => include_str!("../locales/en/cli.json"),
        };
        Self {
            messages: serde_json::from_str(data).unwrap(),
        }
    }

    pub fn get(&self, key: &str) -> &str {
        self.messages.get(key).map(|s| s.as_str()).unwrap_or(key)
    }
}
```

## Locale Detection

```typescript
// packages/renderer/src/i18n.ts
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

// Detection priority:
// 1. User preference (stored in settings)
// 2. OS locale (via Tauri)
// 3. Browser navigator.language
// 4. Fallback: 'en'

i18n
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs: ['en', 'de', 'ja', 'zh-CN', 'es', 'fr', 'ko', 'pt-BR'],
    interpolation: {
      escapeValue: false,  // React handles XSS
    },
    defaultNS: 'common',
    ns: ['common', 'editor', 'settings', 'commands', 'errors'],
  })
```

## Date/Number Formatting

```typescript
// Use Intl built-in formatters via i18next interpolation
// packages/renderer/src/i18n.ts

i18n.services.formatter.add('datetime', (value, lng, options) => {
  return new Intl.DateTimeFormat(lng, {
    dateStyle: options.dateStyle || 'medium',
    timeStyle: options.timeStyle || 'short',
  }).format(new Date(value))
})

i18n.services.formatter.add('relative', (value, lng) => {
  const rtf = new Intl.RelativeTimeFormat(lng, { numeric: 'auto' })
  const diff = Date.now() - new Date(value).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return rtf.format(0, 'day')
  return rtf.format(-days, 'day')
})
```

## Translation Workflow

```
1. Developer adds t('new.key') in code
2. ESLint plugin detects missing key → auto-adds to en/*.json
3. CI checks for untranslated keys
4. Contributor translates via:
   a. Direct PR to locale JSON files
   b. Weblate / Crowdin integration (future)
5. Locale pack is bundled at build time (tree-shaking unused keys)
```

## Build Integration

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [
    // ... existing plugins
    i18nextLoader({
      locales: ['en', 'de', 'ja', 'zh-CN'],
      output: 'src/locales',
    }),
  ],
})
```

## Migration Path

1. **Phase 1**: Install i18next, extract all hardcoded strings to `en/*.json`
2. **Phase 2**: Add `useI18n()` hook to all components
3. **Phase 3**: Tauri command error localization
4. **Phase 4**: CLI localization
5. **Phase 5**: Contributor translation workflow

## String Inventory

| Domain | Approx. Strings | Priority |
|--------|-----------------|----------|
| Common UI | ~120 | High |
| Editor | ~80 | High |
| Settings | ~200 | Medium |
| Command palette | ~60 | High |
| Error messages | ~150 | Medium |
| CLI help | ~100 | Low |
| **Total** | **~710** | |

## Open Questions

- [ ] Lazy-load locale bundles or bundle all at build time?
- [ ] RTL support needed (Arabic, Hebrew)?
- [ ] How to handle user-contributed note templates in i18n?
- [ ] Should frontmatter field names be localized in UI?
- [ ] Plural rules for languages with complex plurals (Arabic, Polish)?
