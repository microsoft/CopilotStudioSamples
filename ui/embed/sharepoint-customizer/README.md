---
title: SharePoint Sidepanel
parent: Embed
grand_parent: UI
nav_order: 6
---
# Copilot Studio side panel for SharePoint

Beta SDK dependency
{: .label .label-yellow }

Embed a Microsoft-authenticated Copilot Studio agent in a SharePoint Framework (SPFx) Application Customizer. The panel uses the Microsoft 365 Agents SDK to discover the agent's conversation endpoints and WebChat's Fluent composer for messages, local files, cards, and suggested replies.

{: .important }
> This is an open-source reference sample, not a production-supported SharePoint channel. For production deployments, consider the [built-in SharePoint channel](https://learn.microsoft.com/en-us/microsoft-copilot-studio/publication-add-bot-to-sharepoint#configure-the-sharepoint-channel). Its capabilities differ from this custom SDK integration; this sample does not enable file uploads in the built-in channel.

{: .warning }
> **This sample currently uses a beta SDK client.** Both `@microsoft/agents-copilotstudio-client` and `@microsoft/agents-activity` are pinned to `1.10.0-beta.7.g65f69dfa27`. The beta is required for endpoint discovery for now; stable SDK `1.9.1` does not contain discovery. These SDK dependencies are prerelease, so review their suitability before production use. WebChat and its Fluent theme use the released version `4.19.2`.

## Features

- **Discovery-first connection:** configure an environment ID and agent schema name; the SDK resolves the correct published conversation endpoints.
- **Microsoft sign-in:** try silent authentication with the current SharePoint user's account, then offer a **Sign in** button when interaction is required or the silent iframe times out.
- **Clean Fluent panel:** responsive sizing, site theme integration, accessible controls, Escape/light-dismiss, and focus restoration.
- **Choose the opening experience:** default to native Fluent starter cards without starting a conversation, or opt into the agent's conversation-start flow instead.
- **Local attachments:** WebChat's native picker, drag-and-drop, clipboard files/images, multiple attachments, previews, and removal.
- **Optional agent activity:** independently enable client-visible reasoning and tool activity. Both are hidden by default.
- **Existing WebChat features:** Markdown, cards, suggested replies, typing, and streamed responses remain available.
- **Launcher:** an icon-only Copilot Studio button opens the agent from SharePoint's supported Top placeholder, below the Microsoft 365 suite header. The sample does not inject elements into the suite header or override SharePoint's built-in Copilot button.
- **Conversation lifecycle:** the single collapse chevron hides the panel while preserving the conversation; **New conversation** (the circular refresh arrow) clears its messages, pending files, and activity details, then follows the configured opening experience.

There is no SharePoint/OneDrive picker, voice integration, or cross-page conversation persistence in this sample.

## Prerequisites

- A published Copilot Studio agent accessible to the signed-in user, configured to [authenticate with Microsoft](https://learn.microsoft.com/en-us/microsoft-copilot-studio/configuration-end-user-authentication#authenticate-with-microsoft).
- Access to create or use an Entra single-page application registration, and consent for delegated `CopilotStudio.Copilots.Invoke`.
- A modern SharePoint site for local sideloading. An app catalog and deployment permissions are only needed for packaged installation.
- Node.js **22.14 or later within v22**, npm, and the SPFx 1.21.1 toolchain.
- For file analysis, an agent/runtime that accepts uploaded files. For standard-harness agents, enable **Settings > Generative AI > File processing capabilities > File uploads**.
- For activity details, a model/runtime that emits the supported client-visible activities described below. Enabling a UI flag does not enable server-side telemetry.

## Architecture

The Application Customizer hosts a Fluent panel. It creates the chat only after the user opens it. MSAL acquires a Power Platform API token. By default, opening the panel does not start an agent conversation: the SDK discovers endpoints on the first submitted message through:

```text
GET https://<environment-host>/copilotstudio/agents/<schemaName>/conversation-endpoints
```

On the first submitted message, the adapter uses `startConversationStreaming(false)` to establish a conversation without firing the welcome event, then sends the message to its execute-turn endpoint. The create-conversation endpoint must not be treated as an execute-turn endpoint: it can return only a session ID and typing activity without processing a supplied message. Subsequent messages reuse the conversation.

Setting `startConversation: true` instead performs discovery and starts the conversation on opening, without showing the sample's starter cards. The sample does not construct agentic-runtime routes or start a separate subscription connection. The SDK retains conversation IDs, including IDs returned only in response headers.

A small adapter around `CopilotStudioWebChat.createConnection` validates local attachments before sending and normalizes two payload families: GHCP/agentic-loop `thought`/`toolCall` entities and standard-harness `DynamicPlan*` events. Both map to WebChat's native Schema.org `Message`/`HowTo` activities. WebChat's Fluent pre-chat and collapsible part-group components render the welcome screen, starter cards, and activity groups; there are no custom reasoning/tool React components or harness-selection settings. A shared incoming subscription replays activities so WebChat's startup and transcript subscriptions do not lose greetings. Only allowlisted reasoning text and tool labels/status are replayed; raw events, arguments, and results are not. Send acknowledgements do not end response monitoring: later response errors are still surfaced, and the composer stays disabled during file preparation and the response to prevent overlapping turns.

The Fluent **copilot** variant and SharePoint theme colors provide the presentation. WebChat's style options are memoized across turn-state updates so response completion does not reset transcript scrolling; theme or upload-setting changes still refresh them. The sample retains released WebChat `4.19.2` and React `17`, compatible with this SPFx version.

The unmodified Copilot Studio SVG is from [Microsoft's official icon collection](https://learn.microsoft.com/en-us/power-platform/guidance/icons) and is included for this sample/training experience. Microsoft's separate icon usage terms apply; review them before reusing the logo in a production application.

`gulpfile.js` maps the SDK beta's Activity browser crypto shim to its **shipped JavaScript** file, because that beta's package mapping otherwise points SPFx at uncompiled TypeScript. No Node crypto polyfill or vendored SDK is required.

## Setup

### 1. Configure Microsoft authentication

1. In [Entra app registrations](https://portal.azure.com/), create or select an application for this sample. For a new registration, choose accounts in your organization. See [Register an application](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app) for the portal steps.
2. Add a **Single-page application** redirect URI matching the SharePoint **site URL without a trailing slash**, for example `https://contoso.sharepoint.com/sites/my-site`.
3. Add a redirect URI for each site where the extension will run. Do not enable implicit grant; MSAL uses authorization code with PKCE.
4. Under **API permissions > Add a permission > APIs my organization uses**, find **Power Platform API** (`8578e004-a5c6-46e7-913e-12f58912df43`).
5. Add delegated **CopilotStudio.Copilots.Invoke** and obtain consent as required by your tenant.
6. Record the application/client ID and directory/tenant ID. **No client secret belongs in this application.**

{: .note }
> The redirect URI is the SharePoint site even during local sideloading. Serving scripts from `https://localhost:4321` does not make localhost the sign-in redirect. MSAL caches authentication in session storage. If silent sign-in cannot complete, select **Sign in** to open a popup and complete any required MFA. The popup is opened from your click, without repeating the failed silent iframe request.

If Power Platform API is missing from your tenant, see [Power Platform API authentication](https://learn.microsoft.com/en-us/power-platform/admin/programmability-authentication).

### 2. Collect the agent settings

In Copilot Studio, open the published agent's metadata and record its **environment ID** and **schema name**. Use the schema name, not the display name or agent GUID.

The recommended configuration omits `directConnectUrl`. Supplying one explicitly bypasses SDK discovery, even when environment/schema values are also present. This override remains available for existing deployments.

### 3. Install dependencies

```bash
git clone https://github.com/microsoft/CopilotStudioSamples.git
cd CopilotStudioSamples/ui/embed/sharepoint-customizer
npm install
```

### 4. Create a local configuration

Create `properties.local.json` in the sample directory. Files named `*.local.json` are gitignored.

```json
{
  "appClientId": "YOUR_APP_CLIENT_ID",
  "tenantId": "YOUR_TENANT_ID",
  "environmentId": "YOUR_ENVIRONMENT_ID",
  "schemaName": "YOUR_AGENT_SCHEMA_NAME",
  "agentTitle": "Team assistant",
  "startConversation": false,
  "showTyping": true,
  "enableFileUpload": true,
  "showReasoning": false,
  "showToolCalls": false,
  "starterPrompts": [
    { "title": "Get started", "text": "What can you help me with?" }
  ]
}
```

| Property | Required | Description / default |
|----------|----------|-----------------------|
| `appClientId` | Yes | Entra SPA application ID |
| `tenantId` | Yes | Directory/tenant ID |
| `environmentId` | For discovery | Power Platform environment ID |
| `schemaName` | For discovery | Agent schema name |
| `agentIdentifier` | No | Legacy alias for `schemaName`; canonical `schemaName` takes precedence |
| `directConnectUrl` | No | Explicit HTTPS connection URL; bypasses discovery |
| `agentTitle` | No | `Copilot Studio Agent` |
| `headerBackgroundColor` | No | Optional launcher-bar CSS color override; otherwise follows the site theme |
| `startConversation` | No | `false`: show the local welcome/starter cards and wait for the first submitted message. `true`: start the agent's conversation immediately and hide the local welcome/starter cards |
| `showTyping` | No | `true`; ordinary typing is independent of reasoning/tool visibility |
| `enableFileUpload` | No | `true` |
| `showReasoning` | No | `false` |
| `showToolCalls` | No | `false` |
| `starterPrompts` | No | Array of `{ "title": "...", "text": "..." }`, used only when `startConversation` is `false`; defaults to the **Get started** card above. Use `[]` for a welcome screen without starter cards |

Use JSON booleans, not strings such as `"false"`. Keep tokens, passwords, client secrets, and browser state out of the configuration.

Starter prompts are public extension configuration, not system instructions. They are not automatically retrieved from the agent's authoring settings. Native cards put the configured text into the composer and focus it; they do not send a message until the user submits. The two opening modes are mutually exclusive: with `startConversation: true`, the agent's own welcome flow runs instead, and its messages and suggested replies render normally.

## Sideload on a real SharePoint page

Application Customizers must be tested on a **live modern SharePoint page**, not the local workbench. Debug sideloading does not require an app-catalog installation and does not create a persistent site customization.

1. Trust the SPFx development certificate if it is not already trusted:

   ```bash
   npx gulp trust-dev-cert
   ```

2. Start the local HTTPS server and leave it running:

   ```bash
   npm run serve
   ```

3. Confirm `https://localhost:4321/temp/build/manifests.js` loads in the review browser. Resolve certificate/local-network permission prompts normally; do not disable browser security.
4. Generate a debug URL using an actual modern page URL from your site:

   ```bash
   npm run sideload -- \
     "https://contoso.sharepoint.com/sites/my-site/" \
     properties.local.json
   ```

5. Open the generated URL in your signed-in browser and select **Load debug scripts**. Open the agent from the launcher.

The helper preserves existing query parameters and encodes `customActions` safely. It uses this extension's manifest ID and omits any settings you did not supply. To use a different local port, configure the server and pass its manifest URL as the third argument.

To end the review, leave the debug URL or close that tab and stop the development server. No app uninstall or persistent custom-action removal is necessary.

### Review with Playwright

Use a named, headed browser session and the generated debug URL:

```bash
playwright-cli -s=sharepoint-review open "<GENERATED_DEBUG_URL>" --browser msedge --headed --persistent
playwright-cli -s=sharepoint-review snapshot
```

Complete sign-in/MFA yourself when required. To use an already signed-in Edge browser that supports remote debugging, enable **Allow remote debugging for this browser instance** at `edge://inspect/#remote-debugging`, then attach:

```bash
playwright-cli -s=sharepoint-review attach --cdp=msedge
playwright-cli -s=sharepoint-review tab-new "<GENERATED_DEBUG_URL>"
```

Keep actions confined to the review tab. On completion, use `detach` for an attached browser; do not close someone else's browser.

Review the default configuration first, then generate URLs with `showReasoning` and `showToolCalls` enabled independently. Check:

- Discovery and a follow-up prompt that retains context.
- With the default `startConversation: false`, no conversation request until the first submission, editable starter text, and a follow-up that keeps the conversation ID.
- With `startConversation: true`, an agent-supplied welcome message and no local starter cards.
- A small, synthetic local document whose contents the agent can identify.
- Picker, paste/drop, attachment removal, rejection of oversized/unsupported files, and attachment-only messages.
- Supported reasoning/tool events, collapsed details, and no detail text when flags are disabled.
- Long streamed replies: follow the latest text through completion, but preserve the reading position when the user deliberately scrolls up.
- Close/reopen, **New conversation**, keyboard focus/Escape, narrow viewports, and error/reconnect behavior.

An upload appearing in the transcript is **not** proof that the agent processed it. Likewise, a working Copilot Studio test pane does not prove the sideloaded SDK connection works. Keep screenshots and diagnostic metadata free of tokens, user identities, and private SharePoint content.

## File input behavior

The sample accepts DOCX, CSV, PDF, TXT, JPG/JPEG, PNG, WebP, and GIF filenames, with a **15 MiB (15 × 1024 × 1024 bytes)** individual-file cap. Empty files are rejected. The checks apply to picker, paste/drop, and outgoing attachments; invalid selections are removed with an explanation before sending.

Files are sent directly in the authenticated conversation as data-URL attachments with their name and MIME type. They are not uploaded into a SharePoint library or a new storage service. Failure to read a local blob aborts the send instead of transmitting an unusable `blob:` URL.

{: .note }
> This is a conservative client policy, not a guarantee of service acceptance. Standard-harness documentation describes a 15 MB file limit, nonanimated GIFs only, PDF page/processed-size restrictions, and text-character limits. The service must still validate actual content, animation, protection, and model limits. Agentic-runtime support can differ. See [Allow file input from users](https://learn.microsoft.com/en-us/microsoft-copilot-studio/image-input-analysis).

Do not upload sensitive files merely to test the sample. Earlier uploaded content may continue to count against the agent's conversation limits; start a new conversation when appropriate.

## Reasoning and tool visibility

**Agent activity** uses WebChat's native collapsible part groups, closed by default. Steps update in place while the response runs and remain in the transcript after it finishes. Each turn has its own group; WebChat owns rendering, focus, status icons, and expansion.

The adapter selects the mapping from the incoming payload, not the agent's URL or display name. Both flags remain independent and default to `false`.

| Runtime payload | `showReasoning` | `showToolCalls` |
|-----------------|-----------------|-----------------|
| GHCP / agentic loop | `entities[].type: "thought"` uses the entity's `text` | `entities[].type: "toolCall"` uses its display name and started/completed/failed status |
| Standard harness | `DynamicPlanStepTriggered.value.thought` becomes a per-step reasoning entry | `DynamicPlanReceived` provides names; `DynamicPlanStepTriggered` and `DynamicPlanStepBindUpdate` identify ongoing steps; `DynamicPlanStepFinished` finishes them |

- GHCP thought deltas append only for explicit `chunkType: "delta"`; replacement/cumulative snapshots replace. Thought chain/step identifiers keep separate thoughts apart, with the stream ID (or the initial activity ID) used when the chain ID is empty. `toolCallId` correlates tools even when multiple invocations share one stream.
- Standard events use `valueType`, falling back to `name` when absent. Their top-level step `thought` is the planning explanation the published runtime sends to the client, not a token-by-token model reasoning stream. It is treated as a snapshot, keyed by plan and step; repeated updates replace rather than append. Tool display names survive clarification or connector-sign-in turns within the conversation.
- Native Schema.org messages tagged `AnalysisMessage` also respect `showReasoning`. The adapter uses WebChat's [documented reasoning activity format](https://github.com/microsoft/BotFramework-WebChat/blob/v4.19.2/docs/CHAIN_OF_THOUGHTS.md); it does not request hidden model chain-of-thought or retrieve authoring-only traces.
- `streamType: "informative"` alone is **not** evidence of reasoning. Tool notifications can use it too. Unclassified informative updates are omitted rather than guessed into a reasoning/tool entry.
- Tool arguments, filled/hidden parameters, descriptions, results, and arbitrary nested `thought` fields are not displayed. Standard reasoning is read only from the top-level `value.thought` of the supported step-trigger event. Binding updates never expose their arguments.
- Unknown events are not guessed into a tool call. A flag being on cannot make an agent emit missing events, and these event families are not guaranteed across all models/harnesses.
- **Started** means tool-step start or binding activity was received; it does not prove that a connector has executed. **Finished** means a finish event was received, not necessarily that the operation succeeded.
- The group completes when the turn finishes. Missing tool-finish events are explicitly labeled rather than invented; failed responses mark the group as interrupted.

Standard-harness plans can pause for clarification or a connector connection before executing a tool. A question or connection card is not evidence of tool completion. Regression tests cover both mappings and all four visibility combinations; verify successful connector execution separately in your environment.

Choose safe, read-only agent actions for review. Do not trigger a business-changing tool just to demonstrate the disclosure.

## Automated deployment (Windows, macOS, Linux)

Complete **Setup** above first. You need an **existing tenant app catalog**, permission to manage its apps, and permission to install apps/customize the target site. The deployment script uses the pinned local [CLI for Microsoft 365](https://pnp.github.io/cli-microsoft365/user-guide/connecting-microsoft-365/).

**Two different identities:** `--app-client-id` is the existing **sidepane SPA registration** from Setup. The CLI uses a separate **deployment app/login**, with the SharePoint permissions and consent required by your chosen authentication method. Invocation consent for `CopilotStudio.Copilots.Invoke` does not grant SharePoint deployment permissions. Follow [Use your own CLI identity](https://pnp.github.io/cli-microsoft365/user-guide/using-own-identity/); the script does not create apps, change authentication, or grant permissions.

1. Sign the local CLI in using your authorized deployment registration and an explicit tenant GUID. Skip this if the correct login is already active:

   ```text
   npm exec -- m365 login --authType deviceCode --appId DEPLOYER_CLIENT_ID --tenant YOUR_TENANT_ID
   npm exec -- m365 status
   npm exec -- m365 spo set --url https://contoso.sharepoint.com
   npm exec -- m365 spo tenant appcatalogurl get
   ```

   Set the tenant's root SharePoint URL explicitly as shown; this avoids needing Graph `Sites.Read.All` just for CLI host autodiscovery.

2. Use the discovered catalog URL, the target **site URL** (not a page/debug URL), and your public `properties.local.json` settings:

   ```text
   npm run deploy -- --site-url https://contoso.sharepoint.com/sites/team --app-catalog-url https://contoso.sharepoint.com/sites/apps --app-client-id YOUR_APP_CLIENT_ID --properties properties.local.json
   ```

3. Open a normal modern page on that site, without sideload/debug parameters. Confirm one Copilot Studio launcher, sign in, and send a message and a follow-up. No localhost server is needed.

The script validates settings and the current login/catalog/site, builds in an isolated temporary directory, XML-escapes the configuration, and checks the production package. It then uploads/enables the app in the catalog, installs it **only on the target site**, and verifies the installed version and one Web-scoped customizer with the requested properties. Its feature creates the initial registration; the script never adds a second custom action. Tracked templates and local settings are not modified.

`--app-client-id` is required and overrides `appClientId` in the JSON file; you can omit that JSON property for deployment. The script prints the exact SPA redirect URI to register, but does not inspect or change Entra registrations. Output is `sharepoint/solution/sidebar-agent.sppkg`, with verified deployment metadata in `sharepoint/solution/deployment.local.json`. Both are gitignored. The package contains public configuration, not secrets.

### Preview, package only, and updates

Append `--dry-run` to validate inputs and print the plan **without building or contacting Microsoft 365**. It is not an authentication/permission check. Append `--package-only` to build and inspect the `.sppkg` without signing in or contacting SharePoint; `--app-catalog-url` is optional in both offline modes. For example:

```text
npm run deploy -- --site-url https://contoso.sharepoint.com/sites/team --app-client-id YOUR_APP_CLIENT_ID --properties properties.local.json --package-only
```

An identical package is reused on subsequent runs; an installed app is not installed again, and drifted site properties are updated on the existing action. For changed code or packaged configuration, increase **both** solution and feature versions in `config/package-solution.json`, then add `--replace` to authorize the catalog update. The script refuses downgrades and different content at the same version.

An explicitly authorized upgrade can replace the original, older tenant-capable package if it was not deployed globally and no matching tenant-wide registration is active. The new package is still site-only. Active global deployment is never silently converted.

{: .warning }
> A tenant catalog is shared. Replacing this solution can affect other installed sites, and its packaged settings become the defaults for future installations. `--replace` acknowledges that broader effect; it does not make the catalog update site-local. Do not run competing deployments or use replacement to configure unrelated sites blindly.

Existing tenant-wide, Site-scoped, duplicate, or standalone registrations must be resolved explicitly before this site-install workflow. Nothing is automatically removed. On failure, the script stops, lists completed remote operations, and leaves the package available for inspection; it does not uninstall apps or roll back a shared catalog. Correct the reported permissions/state issue and rerun, or use the manual path below. A successful metadata check still requires the browser conversation check in step 3.

Run `npm run deploy -- --help` for all options.

## Manual deployment

This is the same supported site-install model, without CLI deployment authentication. Follow Microsoft's [Deploy an SPFx extension](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/extensions/get-started/serving-your-extension-from-sharepoint) and [Manage apps using the SharePoint Apps site](https://learn.microsoft.com/en-us/sharepoint/use-app-catalog) for the SharePoint screens. This sample uses **SPFx 1.21.1/Gulp**, not the Heft commands shown for newer versions.

1. Complete **Setup**, including the runtime SPA registration, exact target-site redirect URI, delegated invocation permission, consent, and published-agent access.
2. Replace placeholders in `sharepoint/assets/elements.xml` with your runtime app client ID, tenant ID, environment ID, and agent schema name. Set any UI flags you need. Keep JSON booleans unquoted and preserve XML escaping: `&quot;` for `"`, `&amp;` for `&`, `&lt;` for `<`, and `&gt;` for `>`. Do not put credentials in this file. Alternatively, use `--package-only` above to generate the configured package without editing XML.
3. If you edited XML manually, build from the sample directory:

   ```text
   npx gulp bundle --ship
   npx gulp package-solution --ship
   ```

4. Upload `sharepoint/solution/sidebar-agent.sppkg` to your **existing tenant Apps site/app catalog**. Select **Only enable this app**, not **Enable this app and add it to all sites**.
5. On the target SharePoint site, use **Site contents > New > App** to add the catalog app. Installation activates the package feature and registers the customizer; do **not** also register it manually.
6. Open a normal modern page, confirm one launcher, sign in if prompted, and verify a reply and same-conversation follow-up without a development server.

The default package requires site installation (`skipFeatureDeployment: false`) and includes only `elements.xml`. `ClientSideInstance.xml` is not packaged and must not be enabled alongside this site action. For upgrades, bump solution/feature versions together, replace the catalog package deliberately, and update the app on the target site. Existing custom-action properties may need an explicit update; the automated path performs that reconciliation.

### Validation

Run `npm test` for configuration, attachment, dual-harness activity mapping, and deployment regression tests; `npm run build` checks the SPFx development build. The **SharePoint sidepane** GitHub Actions workflow runs tests and actual production `--package-only` builds on Windows, macOS, and Linux with synthetic settings. It has no tenant credentials and does not deploy to SharePoint. Live site installation, authentication/consent, and agent responses must be verified separately in your tenant.

## Troubleshooting

| Symptom | Check |
|---------|-------|
| Debug scripts do not load | Local server, trusted HTTPS certificate, actual manifest URL, debug-script/local-network prompts, and tenant restrictions |
| No discovery request | Remove the explicit `directConnectUrl`; check environment ID and schema name |
| Discovery fails | Agent publication/sharing, tenant, delegated invocation permission, service availability; the sample does not silently switch transports |
| Sign-in/redirect failure | Register the exact SharePoint site redirect without a trailing slash, verify consent, and permit the interactive sign-in popup |
| `AADSTS50011` | Add the exact **Redirect URI** shown in the panel to the indicated **Application ID** under **Authentication > Single-page application** in Entra. An unregistered URI can also leave an error inside the silent iframe and appear only as an MSAL timeout |
| `monitor_window_timeout` during silent sign-in | Select **Sign in** to view Microsoft's interactive sign-in page and any detailed error. A timeout alone does not identify the cause. The panel preserves the full error text returned by MSAL and shows the client ID and redirect URI, but cannot read a cross-origin Microsoft error page that never redirects back. Do not relax iframe sandbox restrictions; see [MSAL timeout guidance](https://learn.microsoft.com/en-us/entra/msal/javascript/browser/errors#monitor_window_timeout) |
| Passkey crashes in an automated browser | Use another tenant-approved sign-in method, or attach to a normally signed-in Edge instance; do not bypass MFA |
| File appears but is not analyzed | Verify agent file-input settings, supported content/model/channel, and service-side limits |
| No reasoning/tool details | Enable the correct flag and verify that the published runtime actually sends a supported event family |
| Response fails after sending | A request may already have reached the agent. **Reconnect** starts a new conversation; avoid blindly repeating operations with side effects |

## Resources

- [Microsoft 365 Agents SDK for JavaScript](https://github.com/microsoft/Agents-for-js)
- [Bot Framework WebChat](https://github.com/microsoft/BotFramework-WebChat)
- [SPFx Application Customizer debugging](https://learn.microsoft.com/en-us/sharepoint/dev/spfx/extensions/get-started/build-a-hello-world-extension#debug-your-application-customizer)
- [Tenant graph grounding](https://learn.microsoft.com/en-us/microsoft-copilot-studio/knowledge-copilot-studio#tenant-graph-grounding)
