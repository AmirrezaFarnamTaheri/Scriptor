# Bundled Help translation status

Snapshot on 2026-10-01: English contains all 104 guides. German and Persian authored bodies cover 41 guides: all 16 writing guides, all 17 knowledge guides, and the first eight workflow guides (`export` through `permissions`). Every translated guide includes its title, entry, prerequisite, safety explanation, every step, and every question and answer.

The remaining 63 guides are not translated. The translation data is **not yet composed into the Help UI or search**; those surfaces continue using the existing English content and language notice. Locale routing and RTL body rendering must be completed after full corpus coverage, along with locale search and browser tests. This snapshot must not be described as complete localized Help.

`translations.test.ts` checks the authored batch against the source guide IDs, step counts, question counts, nonempty fields, and untranslated English duplicates. `translationTypes.ts` preserves a narrow content-only interface; translation bodies do not supply selectors, paths, policies, or executable content.
