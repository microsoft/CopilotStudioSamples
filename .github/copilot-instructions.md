# CopilotStudioSamples — Contributor Instructions

This repo uses **Just the Docs** (Jekyll theme) to generate a documentation site with sidebar navigation and full-text search.

## Adding a New Sample

1. Create a folder under the right category: `authoring/`, `extensibility/`, `ui/`, `contact-center/`, `sso/`, `testing/`, `guides/`, `infrastructure/`
2. Add a `README.md` (exact casing) with YAML front matter:

```yaml
---
title: My Sample           # Appears in sidebar nav
parent: Embed              # Must match parent page's title exactly
grand_parent: UI           # Required for level 3 (grandchild) pages
nav_order: 8               # Numeric position among siblings
---
```

3. Write the README with: description, prerequisites, setup instructions
4. Update the parent category's `## Contents` table to include the new sample
5. Test locally: `bundle install && bundle exec jekyll serve`

### Hierarchy Levels

| Level | Front matter | Example |
|-------|-------------|---------|
| Category | `title`, `nav_order`, `has_children: true`, `has_toc: false` | `ui/README.md` |
| Subcategory | `title`, `parent`, `nav_order`, `has_children: true`, `has_toc: false` | `ui/embed/README.md` |
| Sample | `title`, `parent`, `grand_parent`, `nav_order` | `ui/embed/servicenow-widget/README.md` |
| Deep page | `nav_exclude: true`, `search_exclude: false` | Internal subfolders |

### Power Platform Solutions (`authoring/solutions/`)

Solutions follow the [PnP format](https://github.com/pnp/powerplatform-samples):

```
authoring/solutions/my-solution/
├── README.md       # Description, screenshots, install steps
├── assets/         # Screenshots and diagrams
├── solution/       # Packaged .zip file(s) ready to import
└── sourcecode/     # Unpacked source (pac solution unpack)
```

Front matter:
```yaml
---
title: My Solution
parent: Solutions
grand_parent: Authoring
nav_order: 7
---
```

README should include: what it does, screenshots in `assets/`, import steps, connection references to configure, known issues. Update `authoring/solutions/README.md` Contents table after adding.

### External Samples (code in another repo)

Add `external_url` to front matter. This shows a "View sample in M365 Agents SDK repo" button instead of "Browse source on GitHub":

```yaml
---
title: Genesys Handoff
parent: Contact Center
nav_order: 4
external_url: "https://github.com/microsoft/Agents/tree/main/samples/dotnet/GenesysHandoff"
---
```

### Deprecated Samples

Add a red label and caution callout:

```markdown
Deprecated
{: .label .label-red }

{: .caution }
> This sample is deprecated. Use [replacement](../path/) instead.
```

## Markdown Rules

### Callouts — do NOT use GitHub `> [!NOTE]` syntax

Jekyll doesn't support GitHub alerts. Use JTD kramdown callouts:

```markdown
{: .note }
> This is a note.

{: .warning }
> A warning.

{: .tip }
> A tip.

{: .caution }
> A caution.

{: .important }
> Important info.
```

### Links Between Pages

- README links: use directory path `[Sample](./my-sample/)` — NOT `(./my-sample/README.md)`
- Other .md files: drop the extension `[Setup](./SETUP)` — NOT `(./SETUP.md)`
- External URLs: use as-is

### Labels

```markdown
New
{: .label .label-green }

Deprecated
{: .label .label-red }
```

### Liquid Escaping

Markdown containing `{%` (e.g. URL-encoded params) must be wrapped:

````markdown
{% raw %}
```
https://example.com?q={%22key%22:%22value%22}
```
{% endraw %}
````

## Building and Testing Locally

```bash
# Install dependencies (first time only)
bundle install

# Start dev server with live reload
bundle exec jekyll serve
# Site at http://127.0.0.1:4000/CopilotStudioSamples/

# Build without serving (CI check)
bundle exec jekyll build
```

Verify after changes:
- New page appears in sidebar nav
- Search finds the new sample (Ctrl+K)
- Internal links work (no 404s)
- Images render correctly

## Git Workflow

```bash
# Work on the docs branch
git checkout reorg/v1

# Make changes, then commit
git add -A
git commit -m "Add my-new-sample to ui/embed"

# Push to fork — GitHub Actions deploys automatically
git push origin reorg/v1
```

- **Branch**: `reorg/v1` is the docs branch. GitHub Actions builds and deploys to Pages on every push.
- **To merge upstream**: open a PR from `reorg/v1` → `main`. Update `.github/workflows/pages.yml` to trigger on `main` instead of `reorg/v1` before merging.
- **Remotes**: `origin` = fork (`adilei/CopilotStudioSamples`), `upstream` = source (`microsoft/CopilotStudioSamples`)

## Config Gotchas

- `_config.yml` exclude patterns match recursively (`*` matches `/` in Jekyll)
- **Never add `*.html` to exclude** — it breaks theme layout files
- File must be named `README.md` (exact casing) for `jekyll-readme-index` to work
- Category READMEs use `has_toc: false` with a manual Contents table
