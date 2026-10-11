# Bundled Help translation status

Snapshot on 2026-10-01: all 104 bundled guides have authored English, German, and Persian bodies. Every translation includes its title, entry, prerequisite, scope and consequences, every step, and every question and answer. There is no generated English-body fallback.

The Help browser, first-open invitations, related titles, categories, walkthroughs, and direct answers use the selected locale. Search indexes that locale's bundled content and keeps canonical category IDs. Persian content renders right to left with Persian language metadata; German and English render left to right. Locale changes preserve guide IDs and progress.

`translations.test.ts` checks corpus completeness, step and question counts, nonempty fields, English source embedding, runtime body routing, target preservation, localized title and answer searches, and category filtering. `translationTypes.ts` preserves a narrow content-only interface; translations cannot supply selectors, source paths, policies, or executable content. Native browser rendering still requires browser verification; the data tests alone do not prove visual quality or accessibility.
