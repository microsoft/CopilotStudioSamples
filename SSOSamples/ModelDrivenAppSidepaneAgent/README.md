## Model Driven App Sidepane Agent

This sample demonstrates an approach to embedding an agent within a model driven app.  The agent is rendered in the app's sidepane as records are opened, and context is set to ensure the agent knows which record is in view.  The agent uses Microsoft authentication, and the approach provides a seamless authentication experience.

The sample builds heavily on the [Microsoft 365 Agents SDK Copilot Studio Web Client sample](https://github.com/microsoft/Agents/tree/main/samples/nodejs/copilotstudio-webclient), and uses a number of web resources to embed the agent within the Model Driven App:

| Web Resource | Description |
| --- | --- |
| [acquireToken.js](src\Web Resources\acquireToken.js) | deals with the OAuth logic required to obtain a token |
| [agent.css](src\Web Resources\agent.css) | provides basic styling information for the agent |
| [agent.html](src\Web Resources\agent.html) | provides the basic HTML structure and JavaScript necessary for rendering the agent |
| [agent.js](src\Web Resources\agent.js) | provides the logic necessary to initialise the conversation and send context to the agent |
| [agent.settings.js](src\Web Resources\agent.settings.js) | a configuration file where auth related config is stored |
| [app.sidepane.loader.js](src\Web Resources\sidepaneLoader.js) | JavaScript required to manage the sidepane creation within the Model Driven App, including parameter passing for context |
| [dataverseHelpers.js](src\Web Resources\sidepaneLoader.js) | JavaScript helper file responsible for fetching various parameters from the Dataverse Web API necessary for login |
| [icon.svg](src\Web Resources\icon.svg) | An image for the agent |
| [loading.gif](src\Web Resources\loading.gif) | An image for the agent's loading window |

## Prerequisites

Before you begin, ensure you have the following:

1. **Azure Portal Access**
   - Required for creating and configuring app registration
   - Permissions to create new app registrations in your Azure AD tenant

2. **Model Driven App Permissions to Import Solution**
   - Required to create the web resources and customize the app's forms

## Setup Instructions

### Step 1: Configure App Registration

This step requires permissions to create application identities in your Azure tenant. For this sample, create a Native Client Application Identity (no secrets required):

1. **Open Azure Portal**
   - Navigate to [portal.azure.com](https://portal.azure.com)
   - Go to **Azure Active Directory** (Entra ID)

2. **Create a new App Registration**
   - Click **App registrations** → **New registration**
   - Provide a **Name** (e.g., "Side Pane Agent")
   - Choose **"Accounts in this organization directory only"**
   - Under **Redirect URI**:
     - Select **"Single-page application"** from the platform dropdown
     - Enter your model driven app URL (e.g., `https://<<yourorganization>>.crm.dynamics.com`)
   - Click **Register**

3. **Configure API Permissions**
   - In your new application, go to **API Permissions** in the Manage section
   - Click **Add Permission**
   - In the side panel, click the **APIs my organization uses** tab
   - Search for **"Power Platform API"** or use the GUID `8578e004-a5c6-46e7-913e-12f58912df43` (see note below if this is missing)
   - Under **Delegated permissions**, expand **CopilotStudio** and check:
     - `CopilotStudio.Copilots.Invoke`
   - Click **Add Permissions**
   - (Optional) Click **Grant admin consent** for your organization

4. **Note Required Values**
   - On the **Overview** page, copy and save:
     - **Application (client) ID** (e.g., `12345678-1234-1234-1234-123456789012`)

> [!NOTE] 
> If you don't see "Power Platform API" in the list, you need to add it to your tenant first. See [Power Platform API Authentication](https://learn.microsoft.com/en-us/power-platform/admin/programmability-authentication-v2) and follow Step 2 to add the API.

//TODO - import instructions and explanation of significant code, the below is a straw man which needs finishing

**Import instructions**

- Import [solution](SidePaneAgentSample_1_0_0_0.zip)
   - Enter app id from above during import
- Publish all customizations
- ## Needs investigation - are these not solution aware? ##
   - Modify instructions to /reference global variables
   - Publish agent
- Run app (Solutions -> Side Pane Agent Sample -> Apps -> Side Pane Agent Sample -> Play)
- Open an account or contact record
- Observe the side pane is opened and the agent is engaged
- Ask the agent "What am I looking at?" or (or an account record) "which contacts are available?"

**Significant Points**

- SSO is achieved using login hint; the user is already logged into the MDA and MSAL picks up on this
- Much of the usual auth config info is obtained automatically from Dataverse, either from the user context (tenant id, environment id) or via environment variables from the Web API (client id)
- Context info in threaded through from the form to ensure the agent knows which record the user is looking at
- A custom event is used within Copilot Studio to provide the agent with the info it needs to ground itself within the current record

**Known Limitations**
- Doesn't work in InPrivate browsing due to [this issue](https://learn.microsoft.com/en-us/entra/identity-platform/msal-js-known-issues-ie-edge-browsers#other-workarounds)