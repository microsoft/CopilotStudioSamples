# Customization Guide

## Config Options

All options are passed via the config object — from the `CopilotChat.init()` call in `footer.hbs` (Zendesk), or `window.__COPILOT_CONFIG__` in the local test page.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `environmentId` | string | *(required)* | Copilot Studio environment ID (include `Default-` prefix) |
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
| `redirectUri` | string | `window.location.origin` | MSAL redirect URI (set to your Zendesk domain) |

## WebChat Style Overrides

Pass any [WebChat styleOptions](https://github.com/microsoft/BotFramework-WebChat/blob/main/packages/api/src/StyleOptions.ts) via the `styleOptions` config field. These are merged on top of the built-in theme:

```javascript
// Example: override bubble colors
CopilotChat.init(document.body, {
  // ... required fields ...
  styleOptions: {
    bubbleFromUserBackground: '#0078d4',
    bubbleFromUserTextColor: '#ffffff',
  }
});
```

## Changing Config in Zendesk

Edit the `CopilotChat.init()` call in `footer.hbs` via the Zendesk theme code editor. Changes take effect after **Save → Publish**.

## Styling the Bubble and Panel

The bubble and panel colors can be customized without rebuilding the bundle:

```javascript
CopilotChat.init(document.body, {
  // ... required fields ...
  bubbleColor: '#0078d4',   // Blue bubble
  headerColor: '#0078d4',   // Blue header
  panelWidth: '450px',      // Wider panel
  panelHeight: '650px',     // Taller panel
  position: 'bottom-left',  // Left-side placement
});
```

To make deeper UI changes (icons, layout), modify the source in `src/bubble.ts` and rebuild with `npm run build`.
