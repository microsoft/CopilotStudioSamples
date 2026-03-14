# @microsoft/agents-copilotstudio-client

## Overview

The `@microsoft/agents-copilotstudio-client` package allows you to interact with Copilot Studio Agents using the Direct Engine Protocol. This client library is designed to facilitate communication with agents, enabling seamless integration and interaction within your JavaScript or TypeScript applications.

This package provides exports for CommonJS and ES6 modules, and also a bundle to be used in the browser.

> [!NOTE]
> The Client needs to be initialized with a valid JWT Token.

## Installation

To install the package, use npm or yarn:

```sh
npm install @microsoft/agents-copilotstudio-client
```

### Prerequisite

To use this library, you will need the following:

1.  An Agent Created in Microsoft Copilot Studio.
1.  Ability to Create or Edit an Application Identity in Azure
    1. (Option 1) for a Public Client/Native App Registration or access to an existing registration (Public Client/Native App) that has the **CopilotStudio.Copilot.Invoke API Delegated Permission assigned**.
    1. (Option 2) for a Confidential Client/Service Principal App Registration or access to an existing App Registration (Confidential Client/Service Principal) with the **CopilotStudio.Copilot.Invoke API Application Permission assigned**.

### Create a Agent in Copilot Studio

1.  Create or open an Agent in [Copilot Studio](https://copilotstudio.microsoft.com)
    1.  Make sure that the Copilot is Published
    1.  Goto Settings => Advanced => Metadata and copy the following values. You will need them later:
        1.  Schema name - this is the 'unique name' of your agent inside this environment.
        1.  Environment Id - this is the ID of the environment that contains the agent.

### Create an Application Registration in Entra ID to support user authentication to Copilot Studio

> [!IMPORTANT]
> If you are using this client from a service, you will need to exchange the user token used to login to your service for a token for your agent hosted in copilot studio. This is called a On Behalf Of (OBO) authentication token. You can find more information about this authentication flow in [Entra Documentation](https://learn.microsoft.com/entra/msal/dotnet/acquiring-tokens/web-apps-apis/on-behalf-of-flow).
>
> When using this method, you will need to add the `CopilotStudio.Copilots.Invoke` _delegated_ API permision to your application registration's API privilages

### Add the CopilotStudio.Copilots.Invoke permissions to your Application Registration in Entra ID to support User or Service Principal authentication to Copilot Studio

This step will require permissions to edit application identities in your Azure tenant.

1.  In your azure application
    1.  Goto Manage
    1.  Goto API Permissions
    1.  Click Add Permission
        1.  In the side pannel that appears, Click the tab `API's my organization uses`
        1.  Search for `Power Platform API`.
            1.  _If you do not see `Power Platform API` see the note at the bottom of this section._
        1.  For _User Interactive Permissions_, choose `Delegated Permissions`
            1. In the permissions list choose `CopilotStudio` and Check `CopilotStudio.Copilots.Invoke`
            1. Click `Add Permissions`
        1.  For _Service Principal/Confidential Client_, choose `Application Permissions`
            1. In the permissions list choose `CopilotStudio` and Check `CopilotStudio.Copilots.Invoke`
            1. Click `Add Permissions`
            1. An appropriate administrator must then `Grant Admin consent for copilotsdk` before the permissions will be available to the application.
    1.  Close Azure Portal

> [!TIP]
> If you do not see `Power Platform API` in the list of API's your organization uses, you need to add the Power Platform API to your tenant. To do that, goto [Power Platform API Authentication](https://learn.microsoft.com/power-platform/admin/programmability-authentication-v2#step-2-configure-api-permissions) and follow the instructions on Step 2 to add the Power Platform Admin API to your Tenant

## How-to use

The Copilot Client is configured using the `ConnectionSettings` class and a `jwt token` to authenticate to the service.
The `ConnectionSettings` class can be configured using either instantiating the class or loading the settings from a `.env`.

#### Using the default class

There are a few options for configuring the `ConnectionSettings` class. The following are the most _common_ options:

Using Environment ID and Copilot Studio Agent Schema Name:

```ts
const settings: ConnectionSettings = {
  environmentId: "your-environment-id",
  agentIdentifier: "your-agent-schema-name",
};
```

Using the DirectConnectUrl:

```ts
const settings: ConnectionSettings = {
  directConnectUrl: "https://direct.connect.url",
};
```

> [!NOTE]
> By default, it's assumed your agent is in the Microsoft Public Cloud. If you are using a different cloud, you will need to set the `Cloud` property to the appropriate value. See the `PowerPlatformCloud` enum for the supported values

#### Using the .env file

You can use the `loadCopilotStudioConnectionSettingsFromEnv` function to load the `ConnectionSettings` from a `.env` file.

The following are the most _common_ options:

Using Environment ID and Copilot Studio Agent Schema Name:

```
environmentId=your-environment-id
agentIdentifier=your-agent-schema-name
```

Using the DirectConnectUrl:

```
directConnectUrl=https://direct.connect.url
```

#### Example of how to create a Copilot client

```ts
const createClient = async (): Promise<CopilotStudioClient> => {
  const settings = loadCopilotStudioConnectionSettingsFromEnv()
  const token = await acquireToken(settings)
  const copilotClient = new CopilotStudioClient(settings, token)
  return copilotClient
}
const copilotClient = await createClient()
const replies = await copilotClient.startConversationAsync(true)
replies.forEach(r => console.log(r.text))
```
