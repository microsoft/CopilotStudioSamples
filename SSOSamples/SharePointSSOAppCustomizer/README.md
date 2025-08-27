# Copilot Studio Agent Side Panel for SharePoint
![Copilot Studio Agent in SharePoint](./images/agent%20sidepanel.png)

## Summary

This sample demonstrates how to integrate a Microsoft Copilot Studio agent into SharePoint using a SharePoint Framework (SPFx) Application Customizer. It leverages the ReactWebChat component with the [Fluent UI theme pack](https://github.com/microsoft/BotFramework-WebChat#experimental-fluent-ui-theme-pack) and the [Microsoft 365 Agents SDK for NodeJS/TypeScript](https://github.com/microsoft/Agents-for-js) to establish a secure connection with a Copilot Studio agent configured with ['Authenticate with Microsoft'](https://learn.microsoft.com/en-us/microsoft-copilot-studio/configuration-end-user-authentication#authenticate-with-microsoft) authentication.

The key advantage of using the Microsoft 365 Agents SDK is its ability to connect to agents that support Microsoft authentication, which enables [tenant graph grounding](https://learn.microsoft.com/en-us/microsoft-copilot-studio/knowledge-copilot-studio#tenant-graph-grounding) capabilities.

> **Note**: This sample supersedes the [legacy SharePoint SSO Component sample](https://github.com/microsoft/CopilotStudioSamples/tree/main/SSOSamples/SharePointSSOComponent) which uses DirectLine and a modal dialog. 

> [!IMPORTANT]
> ⚠️ **This is an open-source reference sample only.**  
> For production deployments, we strongly recommend using the [built-in SharePoint channel in Copilot Studio](https://learn.microsoft.com/en-us/microsoft-copilot-studio/publication-add-bot-to-sharepoint#configure-the-sharepoint-channel). 

## Features of this sample

- **Single Sign-On (SSO)**: Leverages the current user's SharePoint authentication for seamless agent access
- **Sliding Panel UI**: Modern, responsive chat interface that slides in from the right side of the page
- **Customizable Appearance**: Configure header color and agent title to match your branding
- **New Conversation Support**: Users can start fresh conversations without leaving the page
- **Fluent UI Styling**: Uses the Fluent UI theme pack for a native Microsoft 365 look and feel
- **Tenant Graph Grounding**: Enables the agent to access and search Microsoft 365 content through [tenant graph grounding](https://learn.microsoft.com/en-us/microsoft-copilot-studio/knowledge-copilot-studio#tenant-graph-grounding)

## Prerequisites

Before you begin, ensure you have the following:

1. **Published Copilot Studio Agent**
   - Agent must be configured with ['Authenticate with Microsoft'](https://learn.microsoft.com/en-us/microsoft-copilot-studio/configuration-end-user-authentication#authenticate-with-microsoft) authentication
   - Agent should be published and accessible
   - Consider enabling [tenant graph grounding](https://learn.microsoft.com/en-us/microsoft-copilot-studio/knowledge-copilot-studio#tenant-graph-grounding) for access to Microsoft 365 content

2. **Azure Portal Access**
   - Required for creating and configuring app registrations
   - Permissions to create new app registrations in your Azure AD tenant

3. **SharePoint Administrator Access**
   - Required to deploy the SPFx extension to the app catalog

4. **Development Environment**
   - Node.js v22 (as per SPFx 1.21.1 requirements)
   - npm or yarn package manager
   - Git for cloning the repository

## Technical Architecture

This solution uses:
- **[Microsoft 365 Agents SDK for NodeJS/TypeScript](https://github.com/microsoft/Agents-for-js)**: Provides secure connection and authentication handling for Copilot Studio agents
- **[BotFramework-WebChat with Fluent UI Theme](https://github.com/microsoft/BotFramework-WebChat#experimental-fluent-ui-theme-pack)**: Renders the chat interface with Microsoft 365 styling
- **SharePoint Framework**: Enables deployment as a site-wide extension
- **[Tenant Graph Grounding](https://learn.microsoft.com/en-us/microsoft-copilot-studio/knowledge-copilot-studio#tenant-graph-grounding)**: Allows the agent to search and access Microsoft 365 content

## Setup Instructions

### Step 1: Configure App Registration

This step requires permissions to create application identities in your Azure tenant. For this sample, create a Native Client Application Identity (no secrets required):

1. **Open Azure Portal**
   - Navigate to [portal.azure.com](https://portal.azure.com)
   - Go to **Azure Active Directory** (Entra ID)

2. **Create a new App Registration**
   - Click **App registrations** → **New registration**
   - Provide a **Name** (e.g., "SharePoint Copilot Studio Agent")
   - Choose **"Accounts in this organization directory only"**
   - Under **Redirect URI**:
     - Select **"Single-page application"** from the platform dropdown
     - Enter your first SharePoint site URL without the trailing slash (e.g., `https://contoso.sharepoint.com/sites/mysite`)
   - Click **Register**

3. **Configure Authentication - Add SharePoint URLs**
   - Go to **Authentication** in the Manage section
   - Under **Single-page application**, add redirect URIs:
     - `https://localhost:4321` (only if you plan to test locally - this is the default SPFx port)
     - For each SharePoint site where you'll deploy the extension, add:
       - The site URL **without** trailing slash (e.g., `https://contoso.sharepoint.com/sites/mysite`)
   - Under **Implicit grant and hybrid flows**, ensure both checkboxes are **unchecked** (SPAs use PKCE flow)
   - Click **Save**

   > [!IMPORTANT] 
   > You must add both versions (with and without trailing slash) for EACH SharePoint site where the extension will be deployed. The authentication flow may use either format depending on the context.

   **Example for multiple sites:**
   ```
   https://localhost:4321 (for local testing - default SPFx port)
   https://contoso.sharepoint.com/sites/hr
   https://contoso.sharepoint.com/sites/finance
   https://contoso.sharepoint.com/sites/it
   ```

4. **Configure API Permissions**
   - In your new application, go to **API Permissions** in the Manage section
   - Click **Add Permission**
   - In the side panel, click the **APIs my organization uses** tab
   - Search for **"Power Platform API"** or use the GUID `8578e004-a5c6-46e7-913e-12f58912df43`
   - Under **Delegated permissions**, expand **CopilotStudio** and check:
     - `CopilotStudio.Copilots.Invoke`
   - Click **Add Permissions**
   - (Optional) Click **Grant admin consent** for your organization

5. **Note Required Values**
   - On the **Overview** page, copy and save:
     - **Application (client) ID** (e.g., `12345678-1234-1234-1234-123456789012`)
     - **Directory (tenant) ID** (e.g., `87654321-4321-4321-4321-210987654321`)

> [!NOTE] 
> If you don't see "Power Platform API" in the list, you need to add it to your tenant first. See [Power Platform API Authentication](https://learn.microsoft.com/en-us/power-platform/admin/programmability-authentication) and follow Step 2 to add the API.

### Step 2: Get Copilot Studio Configuration

1. Open your Copilot Studio environment
2. Navigate to your published agent
3. Ensure the agent is configured with ['Authenticate with Microsoft'](https://learn.microsoft.com/en-us/microsoft-copilot-studio/configuration-end-user-authentication#authenticate-with-microsoft)
4. Optionally enable [tenant graph grounding](https://learn.microsoft.com/en-us/microsoft-copilot-studio/knowledge-copilot-studio#tenant-graph-grounding) for Microsoft 365 content access
5. Collect the required configuration values using one of these methods:

   **Option A: Get Direct Connect URL (Recommended)**
   - Go to **Channels** → **Web app**
   - Under **Microsoft 365 Agents SDK**, copy the **Connection string**
   - This will look like: `https://xxxxxxx.07.environment.api.powerplatform.com/...`

   **Option B: Get Environment ID and Agent Identifier**
   - Go to **Settings** → **Advanced** → **Metadata**
   - Copy the following values:
     - **Environment ID**
     - **Schema name** (this is your Agent Identifier, e.g., `cr770_myAgent`)

### Step 3: Clone the Repository

```bash
git clone https://github.com/microsoft/CopilotStudioSamples.git
cd CopilotStudioSamples/SSOSamples/SharePointSSOAppCustomizer
```

### Step 4: Configure the Extension

1. Open `sharepoint/assets/elements.xml` in your editor
2. Update the `ClientSideComponentProperties` with your values:

```xml
ClientSideComponentProperties="{
    &quot;appClientId&quot;: &quot;YOUR_APP_CLIENT_ID&quot;,
    &quot;tenantId&quot;: &quot;YOUR_TENANT_ID&quot;,
    &quot;environmentId&quot;: &quot;YOUR_ENVIRONMENT_ID&quot;,
    &quot;agentIdentifier&quot;: &quot;YOUR_AGENT_IDENTIFIER&quot;,
    &quot;directConnectUrl&quot;: &quot;YOUR_DIRECT_CONNECT_URL&quot;,
    &quot;showTyping&quot;: true,
    &quot;headerBackgroundColor&quot;: &quot;white&quot;,
    &quot;agentTitle&quot;: &quot;Copilot Studio Agent&quot;
}"
```

**Configuration Options:**

| Property | Required | Description | Default |
|----------|----------|-------------|---------|
| `appClientId` | Yes | Your Azure AD app registration client ID | - |
| `tenantId` | Yes | Your Azure AD tenant ID | - |
| `environmentId` | Conditional | Copilot Studio environment ID (required if not using directConnectUrl) | - |
| `agentIdentifier` | Conditional | Your agent's identifier (required if not using directConnectUrl) | - |
| `directConnectUrl` | Conditional | Direct connection URL (use this OR environmentId + agentIdentifier) | - |
| `showTyping` | No | Show typing indicators | `true` |
| `headerBackgroundColor` | No | Header bar color (accepts any CSS color value) | `white` |
| `agentTitle` | No | Display title for the agent | `"Copilot Studio Agent"` |

> [!NOTE]
> You must provide either `directConnectUrl` OR both `environmentId` and `agentIdentifier`.

### Step 5: Test Locally (Optional)

Before building and deploying, you can test the extension locally:

```bash
# Install dependencies
npm install

# Check if gulp is installed, if not, install it
which gulp || npm install -g gulp-cli
# On Windows, use: where gulp || npm install -g gulp-cli

# Serve the solution locally
gulp serve --nobrowser
```

After running `gulp serve`, navigate to the following URL (replace the values with your configuration):

```
https://YOUR-TENANT.sharepoint.com/sites/YOUR-SITE/SitePages/Home.aspx?debugManifestsFile=https://localhost:4321/temp/build/manifests.js&loadSPFX=true&customActions={%224c6e29f2-7eee-4f9f-bbd2-20c8859d0ba2%22:{%22location%22:%22ClientSideExtension.ApplicationCustomizer%22,%22properties%22:{%22appClientId%22:%22YOUR_APP_CLIENT_ID%22,%22tenantId%22:%22YOUR_TENANT_ID%22,%22directConnectUrl%22:%22YOUR_DIRECT_CONNECT_URL%22,%22showTyping%22:true,%22headerBackgroundColor%22:%22white%22,%22agentTitle%22:%22Your%20Agent%20Title%22}}}
```

- Replace `YOUR-TENANT`, `YOUR-SITE`, `YOUR_APP_CLIENT_ID`, `YOUR_TENANT_ID`, and `YOUR_DIRECT_CONNECT_URL` with your actual values
- Ensure you've added `https://localhost:4321` to your app registration's redirect URIs if testing locally

### Step 6: Build and Package

Once you've tested locally (or if you're ready to deploy directly):

```bash
# Build the solution
gulp build

# Bundle the solution
gulp bundle --ship

# Package the solution
gulp package-solution --ship
```

This will create a `.sppkg` file in the `sharepoint/solution` folder.

### Step 7: Deploy to SharePoint

Upload the `.sppkg` file from `sharepoint/solution` to your SharePoint App Catalog. For detailed instructions on creating an app catalog, deploying apps, and adding them to sites, see [Add custom apps to SharePoint](https://learn.microsoft.com/en-us/sharepoint/use-app-catalog#add-custom-apps).

## Troubleshooting

### "Unable to acquire token" error

If you encounter this error:
1. Open your browser's Developer Tools (F12)
2. Go to the **Network** tab
3. Look for failed authentication requests (usually to `login.microsoftonline.com`)
4. Click on the failed requests to see detailed error messages
5. Follow the authentication URLs that MSAL is attempting - the actual error details are often revealed in the response or redirect parameters

Common causes:
- Missing or incorrect redirect URIs in your app registration (check for trailing slashes!)
- Incorrect permissions in the app registration (ensure `CopilotStudio.Copilots.Invoke` is granted)
- Incorrect tenant ID or client ID
- MSAL authentication flow being blocked by browser settings

### "The redirect URI specified in the request does not match the redirect URIs configured for the application" error

Check that the current SharePoint URL has been added as an allowed redirect URI for the provided app registration.

## Additional Resources

- [Built-in SharePoint Channel for Copilot Studio](https://learn.microsoft.com/en-us/microsoft-copilot-studio/publication-add-bot-to-sharepoint#configure-the-sharepoint-channel)
- [Authenticate with Microsoft in Copilot Studio](https://learn.microsoft.com/en-us/microsoft-copilot-studio/configuration-end-user-authentication#authenticate-with-microsoft)
- [Tenant Graph Grounding in Copilot Studio](https://learn.microsoft.com/en-us/microsoft-copilot-studio/knowledge-copilot-studio#tenant-graph-grounding)
- [Microsoft 365 Agents SDK for NodeJS/TypeScript](https://github.com/microsoft/Agents-for-js)
- [BotFramework-WebChat with Fluent UI Theme](https://github.com/microsoft/BotFramework-WebChat#experimental-fluent-ui-theme-pack)
- [Copilot Studio Documentation](https://learn.microsoft.com/en-us/microsoft-copilot-studio/)
- [SharePoint Framework Documentation](https://docs.microsoft.com/en-us/sharepoint/dev/spfx/sharepoint-framework-overview)

## License

This project is licensed under the MIT License - see the LICENSE file for details.
