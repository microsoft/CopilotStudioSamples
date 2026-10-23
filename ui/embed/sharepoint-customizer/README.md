---
title: SharePoint Sidepanel
parent: Embed
grand_parent: UI
nav_order: 6
---
# Copilot Studio side panel for SharePoint

Embed a Microsoft-authenticated Copilot Studio agent in a SharePoint Framework (SPFx) Application Customizer. The panel uses the Microsoft 365 Agents SDK to discover the agent's conversation endpoints and WebChat's Fluent composer for messages, local files, cards, and suggested replies.

{: .important }
> This is an open-source reference sample, not a production-supported SharePoint channel. For production deployments, consider the [built-in SharePoint channel](https://learn.microsoft.com/en-us/microsoft-copilot-studio/publication-add-bot-to-sharepoint#configure-the-sharepoint-channel). Its capabilities differ from this custom SDK integration; this sample does not enable file uploads in the built-in channel.

{: .warning }
> Endpoint discovery currently requires the pinned public SDK preview, `1.10.0-beta.7.g65f69dfa27`. Stable SDK `1.9.1` does not contain discovery. WebChat and its Fluent theme are pinned together at `4.19.2`. Review preview dependency suitability before deploying.

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

1. In [Entra app registrations](https://portal.azure.com/), create or select an application for this sample. For a new registration, choose accounts in your organization.
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

### 4. Create a local review configuration

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

## Build and package

```bash
npm test
npm run build
npx gulp bundle --ship
npx gulp package-solution --ship
```

The package is generated at `sharepoint/solution/sidebar-agent.sppkg`. Before packaged deployment, replace placeholders in `sharepoint/assets/elements.xml` (site custom action) and `sharepoint/assets/ClientSideInstance.xml` (tenant-wide extension instance) for the deployment method you use. Avoid registering both paths on the same site and producing duplicate launchers.

Upload the package to your app catalog only when ready for installation; local review does not require this step. See [Use the SharePoint app catalog](https://learn.microsoft.com/en-us/sharepoint/use-app-catalog).

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
