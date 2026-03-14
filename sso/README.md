---
title: SSO
nav_order: 5
has_children: true
has_toc: false
description: SSO samples for Microsoft Copilot Studio
---
# SSO Samples

Single Sign-On implementations for Copilot Studio agents with various identity providers.

## Contents

| Folder | Description |
|--------|-------------|
| [entra-id/](./entra-id/) | SSO with Microsoft Entra ID |
| [okta/](./okta/) | SSO with Okta identity provider |

## UI samples with SSO

These embed and custom UI samples also implement SSO:

| Sample | SSO approach |
|--------|-------------|
| [ServiceNow Widget](../ui/embed/servicenow-widget/) | MSAL silent / popup SSO |
| [D365 CS + Okta](../ui/embed/d365-cs-okta/) | Okta SSO with D365 Omnichannel |
| [D365 CS + SharePoint](../ui/embed/d365-cs-sharepoint/) | MSAL SSO via SharePoint webpart |
| [SharePoint Customizer](../ui/embed/sharepoint-customizer/) | SharePoint SPFx SSO |
| [PCF Canvas App](../ui/embed/pcf-canvas-app/) | Built-in Canvas App SSO |
| [Assistant UI](../ui/custom-ui/assistant-ui/assistant-ui-mcs/) | MSAL SSO |
| [WebChat React](../ui/custom-ui/webchat-react/) | WebChat React with auth (Node) — *M365 Agents SDK repo* |
| [Web Client](../ui/custom-ui/webclient/) | Web client with auth (Node) — *M365 Agents SDK repo* |

## Prerequisites

- Copilot Studio agent with authentication configured
- Identity provider (Entra ID, Okta, etc.) with app registration
