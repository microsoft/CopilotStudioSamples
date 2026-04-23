---
title: Importing the Agent Solutions
parent: Order Management with Enhanced Task Completion
grand_parent: MCP
nav_exclude: true
---

# Importing the Agent Solutions

## Prerequisites

- A Power Platform environment with Copilot Studio
- Admin or Maker role in the target environment

## Steps

### 1. Import the solution

The solution zip contains both agents, their custom connectors, and connection references — all in one package.

1. Go to [make.powerapps.com](https://make.powerapps.com)
2. Select your target environment
3. Navigate to **Solutions** > **Import solution**
4. Upload `solution/OrderManagementMCPDemo.zip`
5. Click **Next** through the details page
6. If the import wizard shows a **Connections** page, click **New connection** for each connector (no auth needed — just click **Create**), then select the connections you just created
7. Click **Import**

### 2. Create connections

After import, go to **Custom connectors** in the left nav. For each MCP connector (**orders mcp** and **warehouse server 3**), click **Create connection**. The MCP connectors have no authentication — just click **Create** with no credentials.

{: .note }
> In a clean environment the import wizard may skip the Connections step entirely. Creating connections from the Custom connectors page ensures the agents can reach the MCP servers.

### 3. Publish agents

In Copilot Studio, open each agent and click **Publish** to make the latest version live.
