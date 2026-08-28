# Color Semantics and Ownership

**Status:** Active design contract

Scriptor separates color values by responsibility so product state is not encoded by unowned literals.

## 1. Theme and semantic UI colors

Interactive state, status, selection, focus, warnings, errors, success, borders, and application surfaces must consume named CSS custom properties. The current application compatibility layer exposes variables such as `--primary`, `--danger`, `--success`, `--selected`, `--surface`, and `--border`; the tiered token system under `src/styles/tokens/` owns the corresponding primitive and semantic palettes.

Component CSS and React rendering code must not mint a new hex value to mean an application status or interaction state. Add or map a token instead.

## 2. Content and visualization palettes

Persisted or user-authored visual data is different from application chrome. Canvas block fills/strokes, sticky-note colors, annotation colors, graph series/folder palettes, syntax/editor theme definitions, exported SVG defaults, and user-selectable theme palettes may contain literal colors when the literal is part of the content format or named palette itself. Those values must not be reused as an implicit application status color.

## 3. Fallbacks

A component must not bypass token ownership with a raw semantic fallback such as `var(--danger, #b42318)`. Required application tokens are defined by the application theme contract. Content renderers may use stable literal fallbacks when loading user data whose style is absent, because those values describe document content rather than UI state.

## 4. Canvas APIs

SVG presentation attributes can reference CSS variables directly. Canvas 2D APIs require resolved colors, so application-semantic canvas colors are read from the active element's computed custom properties. A visualization palette may be used only as a rendering fallback, not as the source of status semantics.
