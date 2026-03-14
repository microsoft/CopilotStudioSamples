# ChatControl - Power Apps Component Framework (PCF) Control

This sample contains a [PCF](https://learn.microsoft.com/power-apps/developer/component-framework/overview) control that integrates Microsoft Copilot Studio agents into [Canvas Apps](https://learn.microsoft.com/power-apps/maker/canvas-apps/getting-started). It leverages the ReactWebChat component with the [Fluent UI theme pack](https://github.com/microsoft/BotFramework-WebChat#experimental-fluent-ui-theme-pack) and the [Microsoft 365 Agents SDK for TypeScript](https://github.com/microsoft/Agents-for-js) to establish a secure connection with a Copilot Studio agent configured with ['Authenticate with Microsoft'](https://learn.microsoft.com/microsoft-copilot-studio/configuration-end-user-authentication#authenticate-with-microsoft).

## Overview

The ChatControl provides a seamless way to embed Microsoft Copilot Studio agents directly into your Power Apps **Canvas Apps**. It features a modern, responsive chat interface with support for file uploads, custom styling, and real-time message handling.

## Features

- **Authentication**: Built-in single-sign-on (SSO) support for secure agent access
- **Modern Chat UI**: Clean, responsive interface with Bot Framework WebChat and Fluent theme support
- **Customizable Appearance**: Configurable style options to match your application's design
- **New Conversation Support**: Users can start fresh conversations without leaving the page
- **Fluent UI Styling**: Uses the Fluent UI theme pack for a native Microsoft 365 look and feel
- **Copilot Studio Integration**: Direct integration with Microsoft Copilot Studio agents via authenticated connections
- **Message interaction**: Send and receive messages from your app to interact with the agent  
- **Event Support**: Send custom events to agents, for example to initialize variables at the beginning of a chat

## Prerequisites

Before you begin, ensure you have the following:

1. **Published Copilot Studio Agent**
   - Agent must be configured with ['Authenticate with Microsoft'](https://learn.microsoft.com/microsoft-copilot-studio/configuration-end-user-authentication#authenticate-with-microsoft) authentication
   - Agent should be published and accessible

2. **Azure Portal Access**
   - Required for creating and configuring app registrations
   - Permissions to create new app registrations in your Azure AD tenant

3. **System Administrator rights for environment**
   - Required for increasing maximum file size for importing solution with PCF component

4. **Enable Power Apps component framework feature**
   - To add code components to an app, you need to enable the Power Apps component framework feature in each environment where you want to use them. See enable [Power Apps component framework for canvas apps](https://learn.microsoft.com/power-apps/developer/component-framework/component-framework-for-canvas-apps#enable-the-power-apps-component-framework-feature)

## Setup Instructions

### Step 1: Configure App Registration
This step requires permissions to create application identities in your Azure tenant. For this sample, create a Native Client Application Identity (no secrets required):

1. **Open Azure Portal**
   - Navigate to [portal.azure.com](https://portal.azure.com)
   - Go to **Microsoft Entra ID** (Azure AD)

2. **Create a new App Registration**
   - Click **App registrations** → **New registration**
   - Provide a **Name** (e.g., "Copilot Studio Chat Control")
   - Choose **"Accounts in this organization directory only"**
   - Under **Permissions** give this application registration Copilot Studio Invoke permissions 
   - Under **Redirect URI**:
     - Select **"Single-page application"** from the platform dropdown
     - Add the below redirects for the chat control to work when running the app
         1. [https://runtime-app.preview.powerplatform.com/]()
         2. [https://runtime-app.powerplatform.com]()
         3. [https://runtime-app.powerplatform.com/control]()
         4. [https://apps.powerapps.com/]()
         5. Instance URL (example format: [https://org1231243.crm.dynamics.com/]()), see Instance URL in [Session details](https://learn.microsoft.com/power-apps/maker/canvas-apps/get-sessionid) or in the environment details in the Power Platform Admin Center.
     - Add the below redirects for the chat control to work in the Canvas Apps Designer, you can find the island value in the [Session details](https://learn.microsoft.com/power-apps/maker/canvas-apps/get-sessionid), Cluster URI suffix, the island comes before .gateway.prod.island
         1. [https://authoring.**your island**.powerapps.com]()
         2. [https://authoring.**your island**.powerapps.com/control]()
      
        Example: [https://authoring.us-il108.gateway.prod.island.powerapps.com]()

   - Click **Register**

   - Copy **Application (client) ID**, **Directory (tenant) ID** (you will need those values for configuring the chat component)

### Step 2: Get Copilot Studio Configuration

1. Open your Copilot Studio environment
2. Navigate to your published agent
3. Ensure the agent is configured with ['Authenticate with Microsoft'](https://learn.microsoft.com/microsoft-copilot-studio/configuration-end-user-authentication#authenticate-with-microsoft)
4. Collect the required configuration values
   **Get Environment ID and Agent Identifier**
   - Go to **Settings** → **Advanced** → **Metadata**
   - Copy the following values:
     - **Environment ID**
     - **Schema name** (this is your Agent Identifier, e.g., `cr770_myAgent`)
     
### Step 3: Increase maximum file size

1. Navigate to https://make.powerapps.com and make sure the proper environment is selected
2. Click the gear icon (top right) and select Advanced Settings
3. Select Email Configuration
4. Select Email Settings
5. On the Email tab, scroll down to **Set file size limit for attachments** and increase the file size limit to 25,000 kb. 
6. Click OK 

### Step 4: Download and import solution file

1. Download either managed or unmanaged solution file from this Github Repo, see folder Solutions. Preferably download managed solution file.
2. [Import](https://learn.microsoft.com/power-apps/maker/data-platform/import-update-export-solutions) the solution file in the environment

### Step 5: Use the ChatControl in the canvas app

1. In your Power Apps Studio, create a new Canvas App or edit an existing app to which you want to add this Chat component.
2. [Add the chat component to your app](https://learn.microsoft.com/power-apps/developer/component-framework/component-framework-for-canvas-apps#add-components-to-a-canvas-app)
3. Configure the required properties

### Required Properties

The control requires the following configuration properties:

| Property | Type | Description |
|----------|------|-------------|
| `agentTitle` | String | Display title for the agent (defaults to "Agent") |
| `appClientId` | String | Application (client) ID |
| `tenantId` | String | Directory (tenant) ID |
| `environmentId` | String | Power Platform environment ID |
| `agentIdentifier` | String | Copilot Studio agent schema name |
| `username` | String | Current user's email (defaults to `User().Email`) |


### Optional Properties

| Property | Type | Description |
|----------|------|-------------|
| `message` | String | Message to send to the agent |
| `eventValue` | String | Custom event value to send on conversation start |
| `disableFileUpload` | Boolean | Disable file upload functionality |
| `styleOptions` | String | JSON string for WebChat style customization |

### Output Properties

| Property | Type | Description |
|----------|------|-------------|
| `response` | String | Latest response message from the agent |
| `conversationId` | String | Current conversation ID |


### Project Structure

```
ChatControl/
├── ChatControl/
│   ├── Chat/
│   │   ├── Chat.tsx           # Main chat component
│   │   └── acquireToken.ts    # MSAL authentication logic
│   ├── generated/             # Auto-generated manifest types
│   ├── index.ts              # PCF control implementation
│   └── ControlManifest.Input.xml  # Control manifest definition
├── package.json              # Project dependencies and scripts
└── README.md                 # This file
```

## Usage Example

### Style Options

The `styleOptions` property accepts a JSON string following the Bot Framework WebChat style options schema:

```json
{
  "bubbleBackground": "#ffffff",
  "bubbleFromUserBackground": "#0078d4",
  "bubbleFromUserTextColor": "#ffffff",
  "bubbleTextColor": "#000000",
  "rootHeight": "100%",
  "rootWidth": "100%"
}
```
The [Webchat Playground](https://learn.microsoft.com/microsoft-copilot-studio/guidance/kit-webchat-playground) from the [Copilot Studio Kit](https://learn.microsoft.com/microsoft-copilot-studio/guidance/kit-overview) helps you customize the appearance and behavior of your copilot agent Web Chat. The intuitive user interface lets you modify colors, fonts, thumbnails, and more to match your brand's identity.

## Troubleshooting

### "Unable to acquire token" error

If you encounter this error:
1. Open your browser's Developer Tools (F12)
2. Go to the **Network** tab
3. Look for failed authentication requests (usually to `login.microsoftonline.com`)
4. Click on the failed requests to see detailed error messages
5. Follow the authentication URLs that MSAL is attempting - the actual error details are often revealed in the response or redirect parameters

## License

This project is licensed under the MIT License - see the LICENSE file for details.


## Additional Resources

- [Power Apps Component Framework Documentation](https://docs.microsoft.com/powerapps/developer/component-framework/overview)
- [Bot Framework WebChat Documentation](https://github.com/microsoft/BotFramework-WebChat)
- [Microsoft Copilot Studio Documentation](https://docs.microsoft.com/power-virtual-agents/)
- [MSAL.js Documentation](https://docs.microsoft.com/azure/active-directory/develop/msal-overview)
