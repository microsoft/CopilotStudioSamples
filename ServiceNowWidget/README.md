# ServiceNow Widget for Copilot Studio

Embed a Microsoft Copilot Studio agent as a floating chat widget in a ServiceNow Service Portal.

![Chat widget running on a ServiceNow portal](docs/images/chat-widget.png)

The widget uses [BotFramework WebChat](https://github.com/microsoft/BotFramework-WebChat) for rendering and the [M365 Agents SDK](https://www.npmjs.com/package/@microsoft/agents-copilotstudio-client) to connect to Copilot Studio. It authenticates users via MSAL (popup or silent SSO) and renders a floating chat bubble with a slide-up panel — no iframes, no ServiceNow Virtual Agent dependency.

## Prerequisites

- A **ServiceNow** instance with Service Portal (Tokyo or later)
- A **Microsoft Copilot Studio** agent published to the environment
- A **Microsoft Entra ID** app registration (public client / SPA) with redirect URI for your ServiceNow domain
- **Node.js** 18+ (to build the bundle)

## Quick Start

### 1. Configure Entra ID App Registration

The widget authenticates users via MSAL, which requires an app registration in [Azure Portal](https://portal.azure.com):

1. Go to **App registrations** → **New registration** (or use an existing one)
2. Under **Authentication**, add a **Single-page application (SPA)** platform with redirect URIs:
   - `https://<your-instance>.service-now.com` (ServiceNow portal origin)
   - `http://localhost:5500` (local development)
3. Check **Access tokens** and **ID tokens** under **Implicit grant and hybrid flows**
4. No additional API permissions are needed — the SDK scope is derived from the Copilot Studio environment

Note the **Application (client) ID** and your **Directory (tenant) ID** — you'll need them in the deploy config.

### 2. Build the bundle

```bash
cd ServiceNowWidget
npm install
npm run build
```

This produces `dist/copilot-chat.js` (~147 KB), an IIFE bundle that exposes `window.CopilotChat`.

### 3. Deploy to ServiceNow

```bash
# Copy sample config and fill in your values
cp scripts/deploy-config.sample.json scripts/deploy-config.json

# Deploy
npm run deploy
```

The deploy script uses the ServiceNow REST API to create everything needed:

- **System properties** (`copilot.chat.*`) for agent configuration
- **Widget** record with HTML, client script, server script, and CSS
- **Bundle** uploaded as an attachment on the widget record
- **JS Includes** for MSAL, WebChat, and the bundle
- **Widget Dependency** linking all JS Includes with correct load order
- **M2M relationships** (JS Includes ↔ Dependency, Widget ↔ Dependency)
- **Widget instance** on the portal homepage (optional)

The script is **idempotent** — safe to re-run. On re-run, the bundle attachment is replaced with the latest build. If `password` is empty in the config, the script prompts for it.

See [scripts/deploy-config.sample.json](scripts/deploy-config.sample.json) for all configuration options.

> Prefer to set things up manually? See the [Manual Setup Guide](docs/MANUAL-SETUP.md) for step-by-step instructions with screenshots.

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

> **Why IIFE?** ServiceNow's Service Portal loads widget scripts via plain `<script>` tags through its Widget Dependencies system. ES modules are not supported in this context. The bundle must execute in global scope and attach its API to `window`.

## Local Development

Use the test page to develop and debug without ServiceNow:

```bash
cd ServiceNowWidget
npm install

# Copy sample config and fill in your agent settings
cp test-page/config.sample.js test-page/config.js

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
├── docs/
│   ├── MANUAL-SETUP.md            # Step-by-step manual setup guide
│   └── images/                    # Screenshots for documentation
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
├── scripts/                       # Deployment automation
│   ├── deploy.mjs                 # Automated ServiceNow deployment (Node.js)
│   └── deploy-config.sample.json  # Sample config (copy to deploy-config.json)
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
| **CORS errors** | Verify CSP settings. The SDK connects to `*.botframework.com` and `*.powerplatform.com`. |
| **"Bundle not loaded" error** | The Widget Dependency isn't loading the bundle. Verify the JS Include URL is correct and the dependency is linked to the widget. |
| **Auth redirect loop** | Check that the Entra ID app has the correct redirect URI for your ServiceNow instance. |
| **Chat connects but no response** | Verify the `agentIdentifier` matches the agent's schema name in Copilot Studio (not the display name). |
| **UI Script source type doesn't load** | JS Includes with `source=local` ("UI Script" in the UI) generate a `.jsdbx?c=` URL that doesn't work in Service Portal. Use an attachment URL with `source=url` instead. |
| **Two chat bubbles appear** | An old widget instance is still installed. Check the `sp_instance` table for duplicate instances and remove the extra one. Also ensure ServiceNow's built-in Virtual Agent is disabled (see below). |
| **`angular.do` blocked by CSP** | This is a ServiceNow internal URL that gets blocked in some portal configurations. It does not affect the widget — it's a Service Portal framework issue. |

## Disabling the OOTB Virtual Agent Widget

If your ServiceNow instance has the built-in Virtual Agent chat widget enabled and you want to replace it with this widget:

1. Navigate to **Agent Chat > Service Portal Agent Chat Configuration** (`sp_agent_chat_config_list.do`)
2. Find the configuration record for your portal
3. Set **Active** to `false`

> **Note:** This setting is under **Agent Chat**, not under the **Virtual Agent** menu.
