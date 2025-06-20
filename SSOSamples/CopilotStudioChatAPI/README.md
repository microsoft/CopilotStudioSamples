# Copilot Studio Chat API Sample

This sample demonstrates how to use the Copilot Studio Chat API to communicate with a Copilot Studio Agent using Single Sign-On (SSO) authentication. 

> [!CAUTION]
> This sample uses an experimental API that is not officially supported for production use.

## Overview

This sample showcases:
- Single sign-on using Microsoft Authentication Library (MSAL)
- Support for streaming responses (ChatGPT style)
- A "Retrieving" indicator when Knowledge is invoked by the agent

## Prerequisites

- A Copilot Studio agent with "Authenticate with Microsoft" enabled
- Microsoft Entra ID app registration with the appropriate permissions

## Setup Instructions

### 1. Microsoft Entra ID App Registration

1. Create an App Registration in the Microsoft Entra admin center
2. Configure authentication:
   - Click on **Add a platform**
   - Select **Single-page application (SPA)**
   - Enter the redirect URI where your index.html will be hosted (e.g., `https://yourdomain.com/index.html` or `http://localhost:8000/index.html` for local testing)
   - Click **Configure**
3. Configure API permissions:
   - Navigate to **API permission** > **Add permissions**
   - Select **APIs my organization uses**, and search for **Power Platform API**
   - Select **Delegated permissions** > **Copilot Studio** > **Copilot Studio.Copilots.Invoke** permission
   - Click **Add Permissions**
4. Grant admin consent for your directory
5. Navigate to **Overview** and record your app registration's client ID and tenant ID

### 2. Get Copilot Studio Agent Metadata

1. In Copilot Studio, select your agent
2. Navigate to **Settings** > **Advanced**
3. Under Metadata, locate the Schema name
4. Record this values for configuration

### 3. Get Environment URL

1. In Copilot Studio, go to your agent's **Channels** page
2. Select either **Web app** or **Native app**
3. Copy the connection string (next to **Microsoft 365 Agents SDK**)
4. Extract the environment URL from the connection string

For example, if your connection string is:
```
https://08300adc6f65e2abb02298e1cd5c44.08.environment.api.powerplatform.com/copilotstudio/dataverse-backed/authenticated/bots/cr981_myAgent/conversations?api-version=2022-03-01-preview
```

Then your environment URL is:
```
https://08300adc6f65e2abb02298e1cd5c44.08.environment.api.powerplatform.com/
```

### 4. Configure the Sample

Open `index.html` and update the following values:

1. In the MSAL configuration section:
   - Update `clientId` with your Microsoft Entra ID app registration client ID
   - Update `authority` with your tenant ID (`https://login.microsoftonline.com/YOUR_TENANT_ID`)
   - Verify `redirectUri` matches your app's URL

2. In the bot configuration section:
   - Update `botSchema` with your agent's schema name
   - Update `environmentEndpointURL` with your environment URL

```javascript
const msalInstance = new msal.PublicClientApplication({
  auth: {
    clientId: "YOUR_CLIENT_ID",
    authority: "https://login.microsoftonline.com/YOUR_TENANT_ID",
    redirectUri: window.location.origin
  },
  // ...
});

// ...

const strategy = new window.CopilotStudioDirectToEngineChatAdapter.ThirdPartyPublishedBotStrategy({
  botSchema: 'YOUR_SCHEMA_NAME',
  environmentEndpointURL: new URL('YOUR_ENVIRONMENT_URL'),
  getToken: () => token,
  transport: 'auto'
});
```

## Running the Sample

1. Host the sample files on a web server or use a local development server
2. Open the application in a web browser
3. You will be prompted to sign in with Microsoft credentials
4. After successful authentication, the chat interface will connect to your Copilot Studio agent
5. Start chatting with your agent!


## Additional Resources

- [Copilot Studio Documentation](https://learn.microsoft.com/en-us/copilot-studio/)
- [Microsoft Authentication Library (MSAL) Documentation](https://learn.microsoft.com/en-us/azure/active-directory/develop/msal-overview)
- [Integrate web or native apps with Microsoft 365 Agents SDK](https://learn.microsoft.com/en-us/microsoft-copilot-studio/publication-integrate-web-or-native-app-m365-agents-sdk)
- [Bot Framework Web Chat](https://github.com/microsoft/BotFramework-WebChat)
