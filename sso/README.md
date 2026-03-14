# SSO Samples

Single Sign-On implementations for Copilot Studio agents with various identity providers.

> Platform-specific embed samples that include SSO (SharePoint, D365 Customer Service) are under [ui/embed/](../ui/embed/).

## Contents

| Folder | Description |
|--------|-------------|
| [chat-api/](./chat-api/) | SSO with Copilot Studio Chat API (experimental) |
| [entra-id/](./entra-id/) | SSO with Microsoft Entra ID |
| [okta/](./okta/) | SSO with Okta identity provider |

## See also (M365 Agents SDK repo)

- [obo-authorization](https://github.com/microsoft/Agents/tree/main/samples/dotnet/obo-authorization) — On-behalf-of flow to a Copilot Studio agent (.NET, [Node](https://github.com/microsoft/Agents/tree/main/samples/nodejs/obo-authorization), [Python](https://github.com/microsoft/Agents/tree/main/samples/python/obo-authorization))

## Prerequisites

- Copilot Studio agent with authentication configured
- Identity provider (Entra ID, Okta, etc.) with app registration
