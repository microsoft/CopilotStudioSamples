# Copilot Studio Call Agent Connector

This custom connector enables synchronous calls to Microsoft Copilot Studio conversational and autonomous agents from Power Platform applications. It uses an Azure Functions backend service that converts synchronous HTTP requests to asynchronous agent calls using the Agents SDK, making it possible to call an agent from Power Apps or Power Automate and wait for the response in a single operation.

## Prerequisites

- The SyncToAsyncService Function App deployed (see [../SyncToAsyncService/README.md](../SyncToAsyncService/README.md) for deployment instructions)
- Azure subscription with permissions to create App Registrations
- Power Platform CLI (`pac`) installed
- Power Platform environment with permissions to create custom connectors

## Setup Instructions

### Step 1: Clone the Repository (if not already done)

> **Note:** If you've already cloned the repository while deploying the SynctoAsyncService Function App, skip to step 2 below.

1. Clone the CopilotStudioSamples repository:
   ```bash
   git clone https://github.com/microsoft/CopilotStudioSamples.git
   ```

2. Navigate to the connector directory:
   ```bash
   cd CopilotStudioSamples/CallAgentConnector/Connector
   ```

### Step 2: Create Azure App Registration

1. Navigate to [Azure Portal](https://portal.azure.com)
2. Go to **Azure Active Directory** > **App registrations**
3. Click **New registration**
4. Configure the app registration:
   - **Name**: `Copilot Studio Call Agent Connector`
   - **Supported account types**: Select based on your requirements (typically "Accounts in this organizational directory only")
   - **Redirect URI**: Leave blank for now (will be updated later)
5. Click **Register**
6. Note down the following values:
   - **Application (client) ID**
   - **Directory (tenant) ID**

#### Configure API Permissions

1. In your app registration, go to **API permissions**
2. Click **Add a permission**
3. Select **APIs my organization uses**
4. Search for `Microsoft Power Platform`
5. Select **Delegated permissions**
6. Add the permission: `CopilotStudio.Copilots.Invoke`
7. Click **Add permissions**
8. Click **Grant admin consent** (if you have admin privileges)

#### Create Client Secret

1. Go to **Certificates & secrets**
2. Click **New client secret**
3. Add a description and select expiry
4. Click **Add**
5. **Important**: Copy the secret value immediately (you won't be able to see it again)

### Step 3: Update Configuration Files

1. Update `apiProperties.json`:
   - Replace `"clientId": "YOUR_CLIENT_ID"` with your Application (client) ID

2. Update `apiDefinition.json`:
   - Replace `"host": "YOUR_FUNCTION_APP_URL"` with your deployed SynctoAsyncService Function App hostname (e.g., `synctoasyncservice.azurewebsites.net`)

### Step 4: Create the Custom Connector

1. Open a terminal in the connector directory
2. Authenticate with Power Platform:
   ```bash
   pac auth create --environment YOUR_ENVIRONMENT_URL
   ```

3. Create the custom connector:
   ```bash
   pac connector create --api-definition-file apiDefinition.json --api-properties-file apiProperties.json --environment YOUR_ENVIRONMENT_ID --icon-file icon.png
   ```

### Step 5: Update Redirect URI

1. Navigate to your custom connectors in Power Apps:
   ```
   https://make.powerapps.com/environments/YOUR_ENVIRONMENT_ID/customconnectors
   ```
2. Find your "Copilot Studio CAT" connector and click on it
3. Navigate to the **Security** tab
4. Copy the **Redirect URL** shown in the security settings (it will look similar to: `https://global.consent.azure-apim.net/redirect/[connector-specific-id]`)
5. Return to your Azure App Registration in the [Azure Portal](https://portal.azure.com)
6. Go to **Authentication**
7. Click **Add a platform** > **Web**
8. Paste the redirect URI you copied from the Power Platform
9. Click **Configure**

> **Note:** The redirect URI is generated dynamically when the connector is created and will be different from the example shown in `apiProperties.json`. Always use the actual URI from the Power Platform.

### Step 6: Test the Connector

1. Navigate to your custom connectors:
   ```
   https://make.powerapps.com/environments/YOUR_ENVIRONMENT_ID/customconnectors
   ```
2. Find your "Copilot Studio CAT" connector
3. Click on the connector and go to the **Test** tab
4. Create a new connection:
   - Sign in with your Azure AD account
   - Authorize the required permissions
5. Test the `callAgent` operation with sample data

## Usage Example

```json
{
  "environmentId": "abc123-def456-...",
  "agentIdentifier": "my-copilot-agent",
  "message": "What is the weather today?",
  "conversationId": "optional-conversation-id"
}
```

> **Note:** 
> - If you don't provide a `conversationId`, a new conversation will be started with the agent. To continue an existing conversation, include the `conversationId` from a previous response.
> - The `agentIdentifier` is your agent's schema name, which can be found in Copilot Studio under **Settings** > **Advanced** > **Metadata**.

## Additional Resources

- [Microsoft Copilot Studio Documentation](https://learn.microsoft.com/en-us/microsoft-copilot-studio/)
- [Power Platform Custom Connectors](https://learn.microsoft.com/en-us/connectors/custom-connectors/)
- [Power Platform CLI Reference](https://learn.microsoft.com/en-us/power-platform/developer/cli/reference/)