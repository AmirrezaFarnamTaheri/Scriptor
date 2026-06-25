import type { PortalCategory, PortalStore, QuickCaptureStore, ScratchpadState } from './types.ts'

export const DEFAULT_PORTAL_CATEGORIES: PortalCategory[] = [
  { id: 'snippets', label: 'Snippets', icon: 'code', sort: 0 },
  { id: 'links', label: 'Links', icon: 'link', sort: 1 },
  { id: 'templates', label: 'Templates', icon: 'file', sort: 2 },
  { id: 'custom', label: 'Custom', icon: 'star', sort: 3 },
]

export const DEFAULT_PORTAL_ITEMS: PortalStore['items'] = [
  {
    id: 'welcome-link',
    categoryId: 'links',
    title: 'Scriptor docs',
    body: 'https://github.com',
    action: 'copy',
    shortcut: null,
    pinned: true,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  },
  {
    id: 'welcome-snippet',
    categoryId: 'snippets',
    title: 'Meeting notes',
    body: '## Attendees\n\n## Agenda\n\n## Notes\n',
    action: 'insert',
    shortcut: 'mod+shift+m',
    pinned: false,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  },
]

export function createDefaultPortalStore(): PortalStore {
  return {
    version: 1,
    categories: DEFAULT_PORTAL_CATEGORIES.map((category) => ({ ...category })),
    items: DEFAULT_PORTAL_ITEMS.map((item) => ({ ...item })),
  }
}

export function createDefaultScratchpad(): ScratchpadState {
  return { kind: 'scratchpad', body: '', updatedAt: new Date().toISOString() }
}

export function createDefaultQuickCaptureStore(): QuickCaptureStore {
  return {
    version: 1,
    stickies: [],
    todos: [],
    scratchpad: createDefaultScratchpad(),
  }
}
