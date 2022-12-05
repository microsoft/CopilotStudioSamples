# Description

In this demo, we will show how to retrieve the users identity (SSO) and pass this to the bot via a custom canvas. This HTML file will use [MSAL.js](https://github.com/AzureAD/microsoft-authentication-library-for-js) to handle the login via Azure Active Directory, and eventually pass this to your chatbot.

> IMPORTANT: This canvas should mainly be used for demonstration purposes and proof of concepts.

## Setup Power Virtual Agents and Azure Active Directory
Follow the instructions on Microsoft Learn [Configure single sign-on with Azure Active Directory in Power Virtual Agents](https://learn.microsoft.com/en-us/power-virtual-agents/configure-sso).

## Deploy and run the code
1. Look for `TODO` in index.html and change the parameters to your application credentials.
2. Upload the index.html to a website. You can use Blob Storage, App Service and/or Azure Static WebApps for example.
3. Update the app registration with the redirect URI of your website.