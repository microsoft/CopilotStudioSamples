# SyncToAsyncService - Azure Function for Copilot Studio Agent Calls

This Azure Function serves as a bridge between synchronous HTTP requests from Power Platform and the asynchronous Microsoft Copilot Studio Agents SDK. It enables Power Apps and Power Automate to call Copilot Studio agents and wait for responses in a single operation.

## Overview

The function:
- Receives synchronous HTTP POST requests with agent call parameters
- Uses the Microsoft Agents SDK to initiate asynchronous conversations with Copilot Studio agents
- Waits for the agent's response
- Returns the response synchronously to the caller

## Prerequisites

- Node.js 20.x (LTS)
- Azure Functions Core Tools v4
- Azure subscription (for deployment)
- Visual Studio Code with Azure Functions extension (recommended)
- Azure CLI (for deployment)

## Local Development

### 1. Clone the Repository and Navigate to the Function

```bash
# Clone the repository
git clone https://github.com/microsoft/CopilotStudioSamples.git

# Navigate to the SyncToAsyncService directory
cd CopilotStudioSamples/CallAgentConnector/SyncToAsyncService
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Local Settings

Create a `local.settings.json` file in the root directory:

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node"
  }
}
```

### 4. Verify Node.js Version

```bash
# Check your Node.js version
node -v

# Should output v20.x.x or higher
# If not, install Node.js 20.x from https://nodejs.org/
```

### 5. Run the Function Locally

```bash
npm start
```

Or using Azure Functions Core Tools directly:

```bash
func start
```

The function will be available at `http://localhost:7071/api/SyncToAsyncService`

## Using Dev Tunnels for Public URL

To test the function with external services (like Power Platform), you can use Visual Studio Code Dev Tunnels to create a public URL.

See the [Dev Tunnels documentation](https://learn.microsoft.com/en-us/azure/developer/dev-tunnels/get-started) for setup and usage instructions.

Once configured, your function will be accessible at a URL like: `https://[tunnel-name].devtunnels.ms/api/SyncToAsyncService`

## Deployment to Azure

### Quick Deploy

Run the included deployment script:

```bash
# Make the script executable (Mac/Linux)
chmod +x deploy.sh

# Run the deployment
./deploy.sh
```

For Windows PowerShell:
```powershell
# Run the deployment
bash deploy.sh
```

The script will:
1. Login to Azure
2. Create a resource group, storage account, and function app
3. Build and deploy the function
4. Output the function URL

### Alternative: Deploy from VS Code

1. Open the project in VS Code with Azure Functions extension
2. Sign in to Azure (F1 → "Azure: Sign In")
3. Right-click on the Azure Functions icon and select "Deploy to Function App"
4. Follow the prompts to create a new Function App or select an existing one

## Testing the Deployed Function

Once deployed, test your function with curl:

```bash
curl -X POST https://[your-function-app].azurewebsites.net/api/SyncToAsyncService \
  -H "Content-Type: application/json" \
  -d '{
    "environmentId": "your-environment-id",
    "agentIdentifier": "your-agent-id",
    "message": "Hello, agent!"
  }'
```

Expected response:
```json
{"error":"Unauthorized: Bearer token required in Authorization header"}
```

This error is expected and confirms your function is deployed correctly. Authentication will be handled by the Power Platform connector in the next step.

## Next Steps

After deploying this function, proceed to set up the Power Platform custom connector that will use this function as its backend. See [../Connector/README.md](../Connector/README.md) for instructions.