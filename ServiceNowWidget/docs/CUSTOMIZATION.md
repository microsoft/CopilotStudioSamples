# Customization Guide

## Config Options

All options are passed via the config object — from system properties in ServiceNow (via `gs.getProperty()`), or `window.__COPILOT_CONFIG__` in the local test page.

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

## WebChat Style Overrides

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

## Changing Config in ServiceNow

The config values are read from **system properties** by the widget's server script. To change a value:

1. Navigate to **System Properties > All Properties** (`sys_properties_list.do`)
2. Search for the property name (e.g., `copilot.chat.headerTitle`)
3. Update the **Value** field
4. Changes take effect on the next page load — no rebuild or redeployment needed

The deploy script creates properties for the four required fields plus `headerTitle`. To use optional fields like `bubbleColor` or `panelWidth`, create additional system properties (e.g., `copilot.chat.bubbleColor`) and add them to the server script's `data.config` object.
