# MAT-007 — Cross-surface Markdown semantic fixture (initial regression slice)

A single authored Markdown fixture is shared by Scriptor's production editor parser configuration, preview renderer and export diagram transform. The input includes YAML frontmatter, wikilink alias, citation key, GFM table/tasks, Scriptor extended tasks, footnote, inline/block math, Mermaid and raw HTML.

Tests are registered through the existing `check:editor`, `check:renderer` and `check:export` commands. The editor test uses the same exported Lezer configuration as production; preview tests use the real remark/rehype pipeline with its sanitizer; export tests use the real CommonMark diagram transformation and guard unrelated authoring syntax. No parser, mutation boundary or export behavior is changed.

This is a first coverage and drift-detection slice, not an observed failing-first bug repair. Await full exact-head hosted CI before asserting source verification. Round-trip editing, all Markdown constructs, rendered citations, external Pandoc/Typst, installed desktop and release behavior, plugins, and accessibility remain outstanding under MAT-007 issue #187.
