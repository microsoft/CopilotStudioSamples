## Single Sign-On with WebChat

WebChat supports sharing a user's access token over Direct Line. This allows the agent to "act on behalf of the user", by passing the token to a downstream API. 

This pattern requires the application hosting WebChat to obtain an access token using a library like MSAL (or equivalent for non-Entra providers), and post it over Direct Line.

> [!IMPORTANT]
> AI-generated answers from SharePoint and Graph Connector data sources are not available to Guest users in SSO-enabled apps.


| Sample Name | Description | View |
| --- | --- | --- |
| SSOwithEntraID | SSO on Web with Entra ID  | [View][cs#1]|
| 3rdPartySSOWithOKTA | Demonstrates how to implement a seamless SSO experience with a 3rd party authentication provider   | [View][cs#2]|
| SharePointSSOComponent | A SharePoint component demonstrating how copilots can be deployed to SharePoint sites with SSO enabled | [View][cs#3] |
| CopilotStudioChatAPI | Direct integration with Copilot Studio Chat API (experimental) using SSO and streaming responses | [View][cs#4] |


[cs#1]:./SSOwithEntraID
[cs#2]:./3rdPartySSOWithOKTA
[cs#3]:./SharePointSSOComponent
[cs#4]:./CopilotStudioChatAPI
