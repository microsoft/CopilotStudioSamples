---
title: Chat UI Setup
parent: Order Management with Enhanced Task Completion
grand_parent: MCP
nav_exclude: true
---

# Chat UI Setup

The Gradio chat UI authenticates against Copilot Studio using MSAL interactive login. You need an Entra ID App Registration and a `.env` file with your agent details.

## App Registration

1. Go to **portal.azure.com** > **App registrations** > **New registration**
2. Name: e.g., "MCP Demo Chat Client"
3. Supported account types: **Single tenant**
4. Redirect URI: **Public client/native** > `http://localhost`
5. After creation, go to **API permissions** > **Add a permission** > **APIs my organization uses**
6. Search for **CopilotStudio** > select **CopilotStudio.Copilots.Invoke** (delegated)
7. Click **Grant admin consent**
8. Copy the **Application (client) ID** — this is your `AGENTAPPID` below

## Configure `.env`

Copy `chat-ui/.env.sample` to `chat-ui/.env` and fill in:

```env
COPILOTSTUDIOAGENT__ENVIRONMENTID=<your-environment-id>
COPILOTSTUDIOAGENT__SCHEMANAME=<agent-schema-name>
COPILOTSTUDIOAGENT__TENANTID=<your-tenant-id>
COPILOTSTUDIOAGENT__AGENTAPPID=<app-registration-client-id>
```

| Variable | Where to find it |
|---|---|
| `ENVIRONMENTID` | The GUID in your Power Platform URL, or **Settings** > **Session details** in Copilot Studio |
| `SCHEMANAME` | Copilot Studio > open the Orders Agent > **Settings** > **Advanced** > **Schema name** |
| `TENANTID` | Your Entra ID tenant ID (Azure Portal > **Microsoft Entra ID** > **Overview**) |
| `AGENTAPPID` | The Application (client) ID from the App Registration above |
