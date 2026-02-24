# ServiceNow Widget for Copilot Studio

Embed a Microsoft Copilot Studio agent as a floating chat widget in a ServiceNow portal. The widget uses [BotFramework WebChat](https://github.com/microsoft/BotFramework-WebChat) for rendering and the [M365 Agents SDK](https://www.npmjs.com/package/@microsoft/agents-copilotstudio-client) to connect to Copilot Studio.

## Prerequisites

- A **ServiceNow** instance with Service Portal (Tokyo or later)
- A **Microsoft Copilot Studio** agent published to the environment
- A **Microsoft Entra ID** app registration (public client / SPA)
- **Node.js** 18+ (to build the bundle)

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  ServiceNow Portal Page                             │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │  Widget Dependency (Include on page load)     │   │
│  │  ┌─────────────┐ ┌─────────┐ ┌───────────┐  │   │
│  │  │ MSAL Browser│ │ WebChat │ │ Bundle JS │  │   │
│  │  └─────────────┘ └─────────┘ └───────────┘  │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  ┌────────────────────┐    ┌─────────────────────┐  │
│  │  Server Script      │    │  Client Script      │  │
│  │  gs.getProperty()   │───▶│  CopilotChat.init() │  │
│  │  → data.config      │    │                     │  │
│  └────────────────────┘    └────────┬────────────┘  │
│                                     │               │
│  ┌──────────────────────────────────▼────────────┐  │
│  │  Floating Chat Panel                          │  │
│  │  MSAL auth → SDK connection → WebChat render  │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                          │
                          ▼
              Microsoft Copilot Studio
```

1. **Widget Dependencies** load MSAL, WebChat, and the bundle JS as global scripts on page load
2. The **server script** reads agent configuration from ServiceNow system properties via `gs.getProperty()`
3. The **client script** passes the config to `CopilotChat.init()`, which renders a floating chat bubble
4. On first click, the bundle authenticates via MSAL, creates a connection to Copilot Studio, and renders WebChat in a slide-up panel

## Setup Instructions

### Step 1: Build the Bundle

```bash
cd ServiceNowWidget
npm install
npm run build
```

This produces `dist/copilot-chat.js` (~147 KB), an IIFE bundle that exposes `window.CopilotChat`.

### Step 2: Host the Bundle in ServiceNow

Upload the built `dist/copilot-chat.js` to your ServiceNow instance. Two options:

**Option A: Attachment (simplest)**
1. Navigate to **System UI > UI Pages** or any record you can attach files to
2. Attach `copilot-chat.js`
3. Note the attachment URL (e.g., `/sys_attachment.do?sys_id=<id>`)

**Option B: UI Script**
1. Navigate to **System UI > UI Scripts**
2. Create a new UI Script named `CopilotChat`
3. Paste the contents of `dist/copilot-chat.js`
4. Check **Global** = true
5. The URL will be `/scripts/sn/angular.do?sysparm_include=CopilotChat`

### Step 3: Create a Widget Dependency

Widget Dependencies ensure all scripts are loaded before the client controller runs.

1. Navigate to **Service Portal > Dependencies** (`sp_dependency`)
2. Click **New** and create a dependency:
   - **Name:** `Copilot Chat Dependencies`
   - **Include on page load:** checked (true)
3. In the **JS Includes** related list, add three records:

| Order | Name | Source | URL |
|-------|------|--------|-----|
| 100 | MSAL Browser | URL | `https://unpkg.com/@azure/msal-browser@4.13.1/lib/msal-browser.js` |
| 200 | BotFramework WebChat | URL | `https://unpkg.com/botframework-webchat@4.18.0/dist/webchat.js` |
| 300 | Copilot Chat Bundle | URL | *(your attachment or UI Script URL from Step 2)* |

> **Tip:** For production, consider hosting the CDN libraries as ServiceNow attachments too, to avoid external CDN dependencies.

### Step 4: Create System Properties

Navigate to **System Properties > All Properties** (`sys_properties_list.do`) and create the following:

| Property | Description | Example |
|----------|-------------|---------|
| `copilot.chat.environmentId` | Copilot Studio environment ID (GUID) | `00000000-0000-0000-0000-000000000000` |
| `copilot.chat.agentIdentifier` | Agent schema name (from Copilot Studio) | `cr000_myAgent` |
| `copilot.chat.tenantId` | Microsoft Entra tenant ID (GUID) | `00000000-0000-0000-0000-000000000000` |
| `copilot.chat.appClientId` | Entra ID app registration client ID (GUID) | `00000000-0000-0000-0000-000000000000` |
| `copilot.chat.headerTitle` | Chat panel header text (optional) | `Chat with us` |
| `copilot.chat.webchatCdnUrl` | Override WebChat CDN URL (optional) | *(defaults to unpkg v4.18.0)* |
| `copilot.chat.msalCdnUrl` | Override MSAL CDN URL (optional) | *(defaults to unpkg v4.13.1)* |

### Step 5: Create the Widget

1. Navigate to **Service Portal > Widgets** (`sp_widget`)
2. Click **New** and set:
   - **Name:** `Copilot Chat`
   - **ID:** `copilot-chat`
3. Copy the contents of each file from the `servicenow/` folder into the corresponding widget field:

| File | Widget Field |
|------|-------------|
| `widget-html.html` | **Body HTML template** |
| `widget-client.js` | **Client controller** |
| `widget-server.js` | **Server script** |
| `widget-css.scss` | **CSS — SCSS** |

4. In the **Dependencies** related list, add the `Copilot Chat Dependencies` dependency created in Step 3

### Step 6: Add Widget to Portal Page

1. Open your portal in **Service Portal Designer** (append `?id=designer` to the portal URL)
2. Navigate to the page where you want the chat widget
3. Drag the **Copilot Chat** widget into any container on the page
4. The floating bubble will appear in the bottom-right corner regardless of widget placement — it renders with `position: fixed`

### Step 7: Configure Content Security Policy (CSP)

If your ServiceNow instance enforces CSP headers, add these directives:

| Directive | Domains |
|-----------|---------|
| `script-src` | `https://unpkg.com` |
| `connect-src` | `https://login.microsoftonline.com`, `https://*.botframework.com`, `https://default*.environment.api.powerplatform.com` |
| `frame-src` | `https://login.microsoftonline.com` |
| `style-src` | `'unsafe-inline'` (required by WebChat) |

Navigate to **System Properties** and update `glide.http.content_security_policy` or the CSP-related properties for your instance.

### Step 8: Configure Entra ID App Registration

In the [Azure Portal](https://portal.azure.com) → **App registrations** → your app:

1. Under **Authentication**, add a **Single-page application** platform
2. Add redirect URIs:
   - `https://<your-instance>.service-now.com/sp` (production)
   - `http://localhost:5500` (local development)
3. Ensure **Access tokens** and **ID tokens** are checked under **Implicit grant and hybrid flows**
4. Under **API permissions**, no additional permissions are needed — the SDK scope is derived from the Copilot Studio environment

## Local Development

Use the test page to develop and debug without ServiceNow:

```bash
cd ServiceNowWidget

# Install dependencies
npm install

# Copy sample config and fill in your agent settings
cp test-page/config.sample.js test-page/config.js
# Edit test-page/config.js with your real values

# Build the bundle (with watch mode for development)
npm run dev

# In another terminal, serve the project
npx serve . -l 5500
```

Open `http://localhost:5500/test-page/` — the floating chat bubble should appear in the bottom-right corner.

## Project Structure

```
ServiceNowWidget/
├── README.md                      # This file
├── src/                           # TypeScript source
│   ├── index.ts                   # Entry point — validates config, creates bubble
│   ├── config.ts                  # CopilotChatConfig type and defaults
│   ├── auth.ts                    # MSAL three-tier auth (silent → SSO → popup)
│   ├── bubble.ts                  # Floating bubble + panel UI (vanilla JS)
│   └── chat.ts                    # WebChat initialization and connection
├── servicenow/                    # ServiceNow widget files (copy into widget editor)
│   ├── widget-html.html           # Body HTML template
│   ├── widget-client.js           # Client controller
│   ├── widget-server.js           # Server script (reads system properties)
│   └── widget-css.scss            # SCSS styles
├── test-page/                     # Local development test page
│   ├── index.html                 # Simulated ServiceNow portal
│   └── config.sample.js           # Sample config (copy to config.js)
├── package.json
├── tsconfig.json
├── esbuild.config.mjs             # Build config (IIFE bundle)
└── .gitignore
```

## Customization

### Config Options

All options are passed via the config object (from system properties in ServiceNow, or `window.__COPILOT_CONFIG__` in the test page):

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `environmentId` | string | *(required)* | Copilot Studio environment ID |
| `agentIdentifier` | string | *(required)* | Agent schema name |
| `tenantId` | string | *(required)* | Entra tenant ID |
| `appClientId` | string | *(required)* | Entra app client ID |
| `cloud` | string | `'Prod'` | Cloud environment (`Prod`, `Gov`, `High`, `DoD`) |
| `headerTitle` | string | `'Chat with us'` | Panel header text |
| `bubbleColor` | string | `'#1b3e4f'` | Bubble button color |
| `headerColor` | string | `'#1b3e4f'` | Panel header background |
| `panelWidth` | string | `'420px'` | Chat panel width |
| `panelHeight` | string | `'600px'` | Chat panel height |
| `position` | string | `'bottom-right'` | Bubble position (`bottom-right` or `bottom-left`) |
| `zIndex` | number | `9999` | CSS z-index for the widget |
| `debug` | boolean | `false` | Enable SDK console logging |
| `styleOptions` | object | `{}` | WebChat [styleOptions](https://github.com/microsoft/BotFramework-WebChat/blob/main/packages/api/src/StyleOptions.ts) passthrough |
| `redirectUri` | string | `window.location.origin` | MSAL redirect URI |

### WebChat Style Overrides

Pass any [WebChat styleOptions](https://github.com/microsoft/BotFramework-WebChat/blob/main/packages/api/src/StyleOptions.ts) via the `styleOptions` config field. These are merged on top of the built-in ServiceNow Horizon theme:

```javascript
// Example: override bubble colors in system properties or config.js
{
  styleOptions: {
    bubbleFromUserBackground: '#0078d4',
    bubbleFromUserTextColor: '#ffffff',
  }
}
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| **Bubble doesn't appear** | Check browser console for errors. Verify the bundle loaded (`window.CopilotChat` should exist). Check that system properties are set. |
| **"Missing required config" error** | One or more system properties are empty. Verify all four required properties in `sys_properties_list.do`. |
| **MSAL popup blocked** | The browser blocked the auth popup. Ensure popups are allowed for your ServiceNow domain. The first click on the bubble triggers auth. |
| **CORS errors** | Verify CSP settings (Step 7). The SDK connects to `*.botframework.com` and `*.powerplatform.com`. |
| **"Bundle not loaded" error** | The Widget Dependency isn't loading the bundle. Verify the JS Include URL is correct and the dependency is linked to the widget. |
| **Auth redirect loop** | Check that the Entra ID app has the correct redirect URI for your ServiceNow instance (Step 8). |
| **Chat connects but no response** | Verify the `agentIdentifier` matches the agent's schema name in Copilot Studio (not the display name). |

## Disabling the OOTB Virtual Agent Widget

If your ServiceNow instance has the built-in Virtual Agent chat widget enabled and you want to replace it with this widget:

1. Navigate to **Agent Chat > Service Portal Agent Chat Configuration** (`sp_agent_chat_config_list.do`)
2. Find the configuration record for your portal
3. Set **Active** to `false`

> **Note:** This setting is under **Agent Chat**, not under the **Virtual Agent** menu.
