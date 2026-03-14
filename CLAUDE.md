# CopilotStudioSamples

Microsoft Copilot Studio samples repo. GitHub Pages site uses **Just the Docs** (Jekyll theme) for navigation and search.

## Just the Docs Reference

### Navigation Front Matter

Pages are organized via front matter fields — hierarchy is determined by `parent`/`grand_parent`, NOT by file paths.

```yaml
# Top-level page
---
title: UI              # Required. Must be unique among siblings.
nav_order: 3           # Numeric = sorted before alphabetical defaults
has_children: true     # Redundant since v0.10.0, but kept for clarity
---

# Child page
---
title: Embed
parent: UI             # Must match parent's title exactly
nav_order: 2
---

# Grandchild page
---
title: ServiceNow Widget
parent: Embed
grand_parent: UI       # Disambiguates when titles repeat across parents
nav_order: 5
---
```

**Sorting**: Numeric `nav_order` pages come before alphabetical defaults. Integers and floats are equivalent. Same-value pages have unstable order.

**Excluding pages**: `nav_exclude: true` hides from sidebar (still searchable). `search_exclude: true` hides from search index. Both can be combined.

**Nesting**: Unlimited depth since v0.10.0. Every page can have children.

### Callouts (Admonitions)

Just the Docs does NOT support GitHub `> [!NOTE]` syntax. It uses **kramdown block IALs** with callout types defined in `_config.yml`.

**Config** (`_config.yml`):
```yaml
callouts:
  note:
    title: Note
    color: purple
  warning:
    title: Warning
    color: red
  important:
    title: Important
    color: blue
  caution:
    title: Caution
    color: red
  tip:
    title: Tip
    color: green
  highlight:
    color: yellow
```

Predefined colors: `grey-lt`, `grey-dk`, `purple`, `blue`, `green`, `yellow`, `red`. Custom colors via `_sass/custom/setup.scss`.

**Markdown syntax**:
```markdown
{: .note }
> This is a note with the default title from config.

{: .warning }
> A warning callout.
>
> Supports multiple paragraphs.

{: .note-title }
> Custom Title Here
>
> The first line becomes the title when using `-title` variant.

{: .important }
> {: .opaque }
> <div markdown="block">
> {: .warning }
> Nested callout inside an opaque background.
> </div>
```

**Converting GitHub alerts to JTD callouts**:
```
GitHub:                          JTD equivalent:
> [!NOTE]                        {: .note }
> Content here.                  > Content here.

> [!CAUTION]                     {: .caution }
> Content here.                  > Content here.

> [!WARNING]                     {: .warning }
> Content here.                  > Content here.

> [!TIP]                         {: .tip }
> Content here.                  > Content here.

> [!IMPORTANT]                   {: .important }
> Content here.                  > Content here.
```

### Search

Client-side search via lunr.js. Configured in `_config.yml`:
```yaml
search_enabled: true
search:
  heading_level: 2          # Sections split at h2 for granular results
  previews: 3
  preview_words_before: 5
  preview_words_after: 10
  tokenizer_separator: /[\s/\-]+/  # Hyphens split tokens
  focus_shortcut_key: 'k'   # Ctrl+K / Cmd+K to focus search
```

### Other UI Components

- **Labels**: `{: .label .label-green }` inline spans
- **Buttons**: `{: .btn .btn-purple }` styled links
- **Mermaid**: Enable in config, use ` ```mermaid ` code blocks

### Exclude Patterns in _config.yml

Jekyll `exclude` uses `File.fnmatch` **without** `FNM_PATHNAME`:
- `*` matches `/` (any characters), so `*.js` matches `foo/bar/baz.js`
- `*.html` also matches theme layout files — **never use `*.html` in exclude**
- Directory excludes need `*/dirname` form to match at any depth
- `index.html` only matches root — use `*index.html` for recursive

### jekyll-readme-index Plugin

Converts `README.md` → `index.html` pages. Config:
```yaml
readme_index:
  with_frontmatter: true
```
If a directory already has a source `index.html`, the plugin skips it and renders README.md as `README.html` instead (causing duplicates). Fix: exclude source `index.html` files.

## Important Notes

- `*.html` in `_config.yml` exclude breaks theme layouts (entry filter applies to theme `_layouts/*.html` too)
- Source `index.html` files in sample directories must be excluded so `jekyll-readme-index` can convert README.md to the index
- Liquid `{%` sequences in markdown (e.g., URL-encoded params) cause build errors — wrap in `{% raw %}...{% endraw %}`
- `has_children: true` is redundant since JTD v0.10.0 but harmless to keep
- GitHub `> [!NOTE]` alerts render as plain text in Jekyll — must convert to JTD callout syntax
