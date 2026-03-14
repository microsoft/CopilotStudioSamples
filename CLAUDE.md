# CopilotStudioSamples

Microsoft Copilot Studio samples repo with a Just the Docs (Jekyll) site for navigation and search.

**Live site**: https://adilei.github.io/CopilotStudioSamples/

## Repo Structure

```
├── authoring/          # Importable solutions and topic snippets
├── contact-center/     # ServiceNow, Salesforce, Genesys, skill handoff
├── extensibility/      # MCP servers, A2A protocol, M365 Agents SDK
├── guides/             # Implementation guide, workshop, playbook
├── infrastructure/     # VNet and deployment templates
├── sso/                # SSO with Entra ID, Okta, Chat API
├── testing/            # Functional (pytest) and load (JMeter) testing
├── ui/                 # Custom UIs and platform embed samples
│   ├── custom-ui/      # Standalone chat frontends
│   └── embed/          # Widgets for ServiceNow, SharePoint, Power Apps, etc.
├── EmployeeSelfServiceAgent/  # Workday/facilities topics (pending deprecation)
├── _config.yml         # Jekyll configuration
├── _layouts/           # Custom default.html (adds Browse source button)
├── _includes/          # source_link.html (Browse source / external link button)
└── Gemfile             # Jekyll dependencies
```

## Adding a New Sample

1. **Create a folder** under the appropriate category (e.g., `ui/embed/my-sample/`)
2. **Add a `README.md`** with front matter:

```yaml
---
title: My Sample
parent: Embed           # Must match the parent page's title exactly
grand_parent: UI        # Required for level 3 pages
nav_order: 8            # Position among siblings
---
```

3. **Write the README** with: description, prerequisites, setup steps, architecture notes
4. **Name the file `README.md`** (exact casing) — the `jekyll-readme-index` plugin converts it to `index.html`

### For Power Platform Solutions (`authoring/solutions/`)

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

README should include:
- What the solution does and which Copilot Studio features it demonstrates
- Screenshots in `assets/` (reference as `![screenshot](./assets/screenshot.png)`)
- Installation steps (import zip via make.powerapps.com > Solutions > Import)
- Any connection references or environment variables to configure
- Known issues or limitations

Update `authoring/solutions/README.md` Contents table after adding.

### For External Samples (code lives in another repo)

Add `external_url` to front matter — this replaces the "Browse source" button with "View sample in M365 Agents SDK repo":

```yaml
---
title: Genesys Handoff
parent: Contact Center
nav_order: 4
external_url: "https://github.com/microsoft/Agents/tree/main/samples/dotnet/GenesysHandoff"
---
```

### For Deprecated Samples

Add a red label and caution callout at the top:

```markdown
Deprecated
{: .label .label-red }

{: .caution }
> This sample is deprecated. Use [replacement](../path/) instead.
```

## Category README Convention

Each category folder has a README.md with:
- `has_children: true` and `has_toc: false` in front matter
- A manual `## Contents` table (preferred over JTD's auto-generated TOC)
- Optional `## See also` section for cross-references

## Markdown Rules

### Do NOT use GitHub alert syntax

GitHub `> [!NOTE]` alerts render as plain text in Jekyll. Use JTD callouts instead:

```markdown
{: .note }
> This is a note.

{: .warning }
> This is a warning.

{: .tip }
> This is a tip.

{: .caution }
> This is a caution.

{: .important }
> This is important.
```

### Links

- Link to other READMEs as **directories**, not files: `[My Sample](./my-sample/)` not `[My Sample](./my-sample/README.md)`
- Non-README markdown: strip the `.md` extension: `[Setup Guide](./SETUP)` not `(./SETUP.md)`
- External links are fine as-is

### Labels

```markdown
New
{: .label .label-green }

Deprecated
{: .label .label-red }
```

### Liquid Escaping

If markdown contains `{%` (e.g., URL-encoded params), wrap in raw tags:

````markdown
{% raw %}
```
https://example.com?params={%22key%22:%22value%22}
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

**Branch**: `reorg/v1` is the docs branch. GitHub Actions builds and deploys to Pages on every push.

**To merge upstream**: when ready, open a PR from `reorg/v1` → `main`. Update `.github/workflows/pages.yml` to trigger on `main` instead of `reorg/v1` before merging.

**Remotes**:
- `origin` — your fork (`adilei/CopilotStudioSamples`)
- `upstream` — source repo (`microsoft/CopilotStudioSamples`)

## Key Config Notes

- `_config.yml` exclude patterns: `*.js`, `*.ts`, `*.cs` etc. match recursively (`*` matches `/` in Jekyll's fnmatch)
- **Never add `*.html` to exclude** — it breaks theme layouts
- Source `index.html` files are excluded via `*index.html` so `jekyll-readme-index` can use README.md
