# Description

This sample demonstrates how to retrieve an Entra ID access token for a signed-in user, and share the token with Copilot Studio over Direct Line, thus enabling seamless SSO.

## Getting started

1. Follow the instructions on how to [configure user authentication with Microsoft Entra ID]([https://learn.microsoft.com/en-us/microsoft-copilot-studio/](https://learn.microsoft.com/en-us/microsoft-copilot-studio/configuration-authentication-azure-ad?tabs=fic-auth)
2. Follow the instructions on how to configure a second [app registration for a canvas app](https://learn.microsoft.com/en-us/microsoft-copilot-studio/configure-sso?tabs=webApp). Set the redirect URI in your app registration based on where the sample will be deployed (e.g. localhost, static web app, etc.)
3. Replace the values for Client ID, Tenant ID and Token Endpoint under `TODO` in [index.html](./index.html)
4. Deploy index.html to a host of your choice

<br>

> **IMPORTANT:** This sample requires users to click on a sign-in button. This behavior is just for demonstration purposes, while in production, the initial sign-in should be managed by your application.
