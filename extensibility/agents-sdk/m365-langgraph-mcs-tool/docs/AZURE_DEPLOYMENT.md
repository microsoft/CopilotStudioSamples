---
nav_exclude: true
search_exclude: false
---

# Azure deployment guide

How to provision Azure resources and deploy the LangGraph + Copilot Studio proxy agent
using the **Microsoft 365 Agents Toolkit** (`atk`). For local debugging instead, see the
[local development guide](LOCAL_DEPLOYMENT).

## Prerequisites

- **Node.js 22 or 24** and npm.
- **Microsoft 365 Agents Toolkit CLI** (`atk`) — optional; the deploy script runs it via `npx`
  if it isn't installed. To install globally: `npm install -g @microsoft/m365agentstoolkit-cli`
- **Azure subscription** with rights to create resources and assign roles.
- A **published Copilot Studio agent** — its **environment ID** and **schema name**.
- An **Azure OpenAI** resource with a chat **deployment** and its **API key**.
- A **Microsoft 365 tenant** where you can upload a custom app.

## Option A — one command (recommended)

From the sample root:

```bash
./scripts/deploy.sh        # macOS/Linux
./scripts/deploy.ps1       # Windows (PowerShell)
```

The script:

1. Checks that `node` and `npm` are installed, and resolves the `atk` CLI (using `npx` if it
   isn't installed globally).
2. Prompts for anything not already set: `MCS_ENVIRONMENT_ID`, `MCS_SCHEMA_NAME`,
   `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_DEPLOYMENT`, the Azure OpenAI API key, and
   (optionally) the target subscription/resource group.
3. Writes non-secret values to `env/.env.dev` and the API key to `env/.env.dev.user`
   (git-ignored), generating a unique `RESOURCE_SUFFIX` if needed.
4. Runs `npm install` and `npm run build`.
5. Runs `atk provision --env dev` then `atk deploy --env dev`.

Values already present in your shell environment or in `env/.env.dev` are reused, so the
script is idempotent and safe to re-run.

## Option B — run the toolkit steps yourself

1. Fill in `env/.env.dev` (see [Configuration](#configuration)) and put the API key in
   `env/.env.dev.user`:

   ```ini
   # env/.env.dev.user  (git-ignored)
   SECRET_AZURE_OPENAI_API_KEY=<your-azure-openai-key>
   ```

2. Provision and deploy:

   ```bash
   atk provision --env dev
   atk deploy --env dev
   ```

   `atk` will prompt you to sign in to Azure and Microsoft 365 if you aren't already.

## Configuration

| Variable | Required | Description |
|----------|----------|-------------|
| `MCS_ENVIRONMENT_ID` | Yes | Power Platform environment ID of the Copilot Studio agent. |
| `MCS_SCHEMA_NAME` | Yes | Schema name of the Copilot Studio agent. |
| `MCS_CONNECTION_NAME` | No | Bot Service OAuth connection name. Defaults to `mcs`. |
| `AZURE_OPENAI_ENDPOINT` | Yes | Azure OpenAI endpoint URL. |
| `AZURE_OPENAI_DEPLOYMENT` | No | Chat deployment name. Defaults to `gpt-4o`. |
| `AZURE_OPENAI_API_VERSION` | No | Defaults to `2024-12-01-preview`. |
| `SECRET_AZURE_OPENAI_API_KEY` | Yes | Azure OpenAI API key — goes in `env/.env.dev.user`. |
| `AZURE_SUBSCRIPTION_ID` | No | Blank ⇒ prompted during provision. |
| `AZURE_RESOURCE_GROUP_NAME` | No | Blank ⇒ prompted/created during provision. |
| `RESOURCE_SUFFIX` | No | Makes resource names globally unique. Auto-generated if blank. |

Bicep injects these as **App Service application settings**, so the deployed bot reads its
configuration from Azure — there is no runtime `.env` in the cloud.

## What gets provisioned

`infra/azure.bicep` (and its modules) create:

- A **user-assigned managed identity** used by the bot (no client secret in production).
- An **App Service plan + Web App** hosting the Node.js bot.
- An **Azure Bot** resource with the Teams and Microsoft 365 channels.
- Two **OAuth connections** on the bot:
  - **`SsoConnection`** — Teams/Microsoft 365 single sign-on into the bot.
  - **`mcs`** — delegated access to the Power Platform API
    (scope `https://api.powerplatform.com/.default`, permission
    `CopilotStudio.Copilots.Invoke`) used to call Copilot Studio on behalf of the user.
- An **Entra app registration** granted the Power Platform API permissions.
- **Application Insights** for logs and telemetry.

Provision writes generated values (`BOT_ID`, `WEBAPPID`, `BOT_DOMAIN`, `SSO_APP_ID`,
`TEAMS_APP_ID`, `M365_TITLE_ID`, `M365_APP_ID`, …) back into `env/.env.dev`.

## Install the app

After deploy, install the package the toolkit built:

```bash
atk install --file-path appPackage/build/appPackage.dev.zip --env dev
```

Or in Teams: **Apps → Manage your apps → Upload an app → Upload a custom app**, then select
`appPackage/build/appPackage.dev.zip`. The agent also appears in Microsoft 365 Copilot.

## Testing the deployed agent

The first time any user messages the agent, they are asked to sign in — this grants the
delegated Copilot Studio access. After that, ask a hotel question (e.g. *"What are the
available hotels?"*) and the Copilot Studio agent's answer streams back.

**Automated smoke test.** From the sample root:

```bash
npm run smoke
```

`scripts/smoke-test.mjs` enables the Direct Line channel on the provisioned bot (via the
Azure CLI), starts a conversation, sends a hotel prompt, and prints the streamed reply.
Because every turn requires the `MCS` sign-in, when the bot returns a sign-in card the
script prints the sign-in URL — open it once, then re-run. Requirements: the
[Azure CLI](https://learn.microsoft.com/cli/azure/) signed in (`az login`) to the
subscription that holds the bot.

**Teams / Microsoft 365 Copilot.** For a fully interactive check, open the installed agent
in Teams or Microsoft 365 Copilot, complete the SSO sign-in, and chat — SSO is seamless
there.

## Update, redeploy, clean up

- **Code change:** `atk deploy --env dev` (or re-run the deploy script).
- **Infra change:** `atk provision --env dev` again.
- **Remove everything:** delete the Azure resource group, and remove the app from
  *Manage your apps* / Teams Admin Center.

## Troubleshooting

- **`extendToM365` step fails intermittently.** The resources still deploy; upload
  `appPackage/build/appPackage.dev.zip` manually as above.
- **Name conflicts during provision.** Set a unique `RESOURCE_SUFFIX` and re-run.
- **Agent starts but errors on Copilot Studio calls.** Verify `MCS_ENVIRONMENT_ID` /
  `MCS_SCHEMA_NAME` point at a *published* agent and that the `mcs` OAuth connection and
  Power Platform admin consent are in place.
- **Sign-in fails.** Confirm the Entra app registration has admin consent for the Power
  Platform API permissions granted in `infra/modules/app-registration.bicep`.
