---
nav_exclude: true
search_exclude: false
---

# Local development guide

Run and debug the proxy agent on your machine with a dev tunnel, then test it in Teams or
Microsoft 365 Copilot. For a cloud deployment, see the
[Azure deployment guide](AZURE_DEPLOYMENT).

## How local run works

Local development still provisions a few Azure/Entra resources (an app registration, an
Azure Bot pointing at your dev tunnel, and the `SsoConnection` + `mcs` OAuth connections),
but the **bot code runs locally**. The Microsoft 365 Agents Toolkit orchestrates this from
`m365agents.local.yml` and writes runtime settings to `.localConfigs`.

## Prerequisites

- **Node.js 22 or 24** and npm.
- **Microsoft 365 Agents Toolkit** — the
  [VS Code extension](https://marketplace.visualstudio.com/items?itemName=TeamsDevApp.ms-teams-vscode-extension)
  (for F5) or the `atk` CLI.
- **Dev Tunnels CLI** — [install guide](https://learn.microsoft.com/azure/developer/dev-tunnels/get-started).
- **Azure subscription** (for the local Bot resource) and an **Entra tenant** where you can
  register apps and upload a custom app.
- A **published Copilot Studio agent** (environment ID + schema name) and an **Azure OpenAI**
  deployment + key.

## 1. Configure environment

`env/.env.local` is created/seeded automatically (via `scripts/env.js`). Set the Copilot
Studio and Azure OpenAI values there:

```ini
# env/.env.local
MCS_CONNECTION_NAME=mcs
MCS_ENVIRONMENT_ID=<your-environment-id>
MCS_SCHEMA_NAME=<your-agent-schema-name>
AZURE_OPENAI_ENDPOINT=https://<res>.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT=gpt-4o
```

Put secrets in `env/.env.local.user` (git-ignored):

```ini
# env/.env.local.user
SECRET_AZURE_OPENAI_API_KEY=<your-azure-openai-key>
```

`SECRET_BOT_PASSWORD` is generated for you when the local bot's app registration is created.

## 2. Run with F5 (VS Code)

Open the folder in VS Code with the Agents Toolkit extension and press **F5**, then choose a
launch target:

- **Launch App (Edge)** / **Launch App (Chrome)** — opens the agent in Teams.
- **(Preview) Launch Remote in Copilot (Edge)** — opens it in Microsoft 365 Copilot.

The toolkit starts a dev tunnel, provisions the local resources, builds, and runs the bot.

## Alternative: run from the CLI

```bash
atk provision --env local     # creates the local bot + OAuth connections + tunnel config
npm run dev:teamsfx           # runs the bot locally against .localConfigs
```

Then upload `appPackage/build/appPackage.local.zip` in Teams
(**Apps → Manage your apps → Upload a custom app**).

The `scripts/devtunnel.sh` / `scripts/devtunnel.ps1` helpers can start and manage the dev
tunnel if you prefer to run it manually.

## 3. Test

Message the agent; the first turn prompts a one-time sign-in that grants delegated Copilot
Studio access. Ask a hotel question (e.g. *"What are the available hotels?"*) and watch the
Copilot Studio agent's answer stream back. Set breakpoints in `src/agent.ts` or
`src/mcs/*.ts` to step through orchestration and the tool call.

## Troubleshooting

- **Tunnel not found / bot unreachable.** Ensure the Dev Tunnels CLI is installed and you're
  signed in (`devtunnel user show`); re-run F5 / `atk provision --env local`.
- **`MCS_ENVIRONMENT_ID is not configured`.** Fill the values in `env/.env.local` and restart.
- **Sign-in loops.** Confirm the local `mcs` OAuth connection was created and the app
  registration has admin consent for the Power Platform API permissions.
- **Azure OpenAI 401/404.** Recheck `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT`, and
  the key in `env/.env.local.user`.
