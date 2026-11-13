---
title: Live agent handover installation
nav_exclude: true
search_exclude: false
---
# Install the live agent handover sample

[Back to the overview](./)

Set up the Copilot Studio agent, deploy the relay, and test handover in Teams. Choose one hosting option:

| | Local relay + tunnel | Azure-hosted relay |
|---|---|---|
| Runs on | Your computer | Azure App Service |
| Support console | Local browser | Public web app |
| State | Local file; one relay process | Azure Blob Storage |

{: .caution }
> Demo only. Use synthetic data. The escalation webhook and support console have no authentication. See the [production-hardening notes](./#notes).

## Prerequisites

Use the same tenant for Azure, Copilot Studio and Microsoft 365.

| Requirement | Setup |
|---|---|
| Node.js 24 LTS and npm | Install before running the sample commands. |
| Copilot Studio | Environment with the **Microsoft Copilot Harness** agent type and maker hooks enabled; permission to import solutions and publish agents/workflows. |
| Azure subscription | Permission to deploy resources, assign Azure roles, and create Microsoft Entra app registrations and service principals. |
| Azure CLI | [Install](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli) and sign in to the target subscription. |
| Power Platform CLI (`pac`) | [Install](https://learn.microsoft.com/en-us/power-platform/developer/cli/introduction) and authenticate to the same environment. |
| [Microsoft 365 Agents Toolkit (ATK)](https://learn.microsoft.com/en-us/microsoftteams/platform/toolkit/microsoft-365-agents-toolkit-cli) | Installed and signed in during [step 6](#6-install-the-teams-app-through-atk). |
| Dev tunnels CLI, local option only | [Install and sign in](https://learn.microsoft.com/en-us/azure/developer/dev-tunnels/get-started) with `devtunnel user login`. |

## 1. Import the solutions

Import the **connector first**, then the **agent**. Microsoft documents this order for [custom connectors and their connection references](https://learn.microsoft.com/en-us/connectors/custom-connectors/customconnectorssolutions#known-limitations).

| Order | File in `solution/` | Contents |
|---|---|---|
| 1 | [CopilotStudioHandoverConnector_1_0_0_0.zip](./solution/CopilotStudioHandoverConnector_1_0_0_0.zip?raw=true) | **Handover escalation** custom connector |
| 2 | [CopilotStudioHandover_1_0_0_0.zip](./solution/CopilotStudioHandover_1_0_0_0.zip?raw=true) | Copilot Studio agent, Escalate tool, scoped hook, workflow and connection reference |

For each package:

1. In [Power Apps](https://make.powerapps.com), select the target environment, then **Solutions > Import solution**.
2. Select **This device > Browse**, choose the ZIP file, and select **Next**.
3. Keep **Enable Plugin steps and flows included in the solution** enabled. When importing the agent, select or create a connection for **Handover escalation**. This demo connector uses **No authentication**.
4. Select **Import** and wait for completion.

The agent is **Copilot Studio Handover Sample**, with schema name **`cpshnd_handover`**. Its **Escalate** tool and **Pre tool use** hook are already connected. Do not recreate them.

These are unmanaged development solutions. Import updates can overwrite existing customizations. See [Microsoft's solution import procedure](https://learn.microsoft.com/en-us/power-apps/maker/data-platform/import-update-export-solutions).

## 2. Configure the relay

Run all remaining commands from `contact-center/microsoft-copilot-harness-handover`:

```sh
npm ci
npm run configure -- --subscription YOUR_SUBSCRIPTION_GUID --environment-id YOUR_ENVIRONMENT_GUID --schema-name cpshnd_handover
```

Use the [Environment ID](https://learn.microsoft.com/en-us/power-platform/admin/determine-org-id-name#find-your-environment-and-organization-ids) of the environment where you imported the solutions. The script reads the tenant ID from the selected Azure subscription.

Review the tenant, environment, subscription and resource names in `.local/config.json`. Then create the sample's bot and SSO identities:

```sh
node scripts/setup.mjs identity --approve-identity
npm run doctor
```

**Consent:** `CopilotStudio.Copilots.Invoke` lets the relay call the agent as the signed-in user. The identity command adds it to the SSO app; tenant policy may require admin approval.

Keep `.local/` private. It contains credentials, resource identities and deployment state; do not commit it or copy it to a different tenant.

## 3. Deploy the relay

Choose **A or B**. Copilot Studio remains cloud-hosted in both options.

### A. Local relay and tunnel

```sh
npm run local -- --approve-azure
```

The command builds and starts the relay and support console, hosts a persistent dev tunnel, and provisions Azure Bot and its Teams channel.

| Output | Use |
|---|---|
| Printed **Callbacks** URL | Connector host in step 4 |
| `http://127.0.0.1:3978/support.html` | Support console |
| `.local/teams-m365.local.zip` | Generated Teams app package |

**Keep this terminal running.** The tunnel exposes callbacks on port `3979`, not the support console on `3978`. Use another terminal for the remaining commands.

### B. Azure-hosted relay

{: .warning }
> This option is not yet verified end to end. It creates billable Azure resources and exposes the unauthenticated demo console publicly.

```sh
npm run deploy -- --approve-identity --approve-azure
```

The command deploys App Service, a managed identity, Blob Storage, Azure Bot and the application code.

| Output | Use |
|---|---|
| Printed App Service HTTPS URL | Connector host in step 4 |
| Printed URL + `/support.html` | Support console |
| `.local/teams-m365.azure.zip` | Generated Teams app package |

## 4. Set the connector host

1. In Power Apps, open the imported **Handover escalation** custom connector and select **Edit**.
2. On **General**, replace **Host** (`relay.example.com`) with the hostname from step 3. Enter only the hostname, without `https://` or a path.
3. Leave the HTTPS scheme, base URL `/`, **No authentication** setting and **Escalate** operation unchanged.
4. Select **Update connector**.

Example: if the local script prints `Callbacks: https://example-3979.euw.devtunnels.ms`, enter `example-3979.euw.devtunnels.ms`.

If no connection was selected during import, create one from the connector's **Test > New connection** action. In the agent solution, open the existing `cpshnd_handover_escalation` **connection reference**, select that connection and save.

References: [custom connector settings](https://learn.microsoft.com/en-us/connectors/custom-connectors/define-openapi-definition#review-general-details), [connection references](https://learn.microsoft.com/en-us/power-apps/maker/data-platform/create-connection-reference).

Do not run the optional `npm run connector -- --approve-connector` provisioning path for this installation: the connector already came from the solution.

## 5. Publish the Copilot Studio agent

1. Open **Copilot Studio Handover Sample** in the target environment.
2. Select **Publish**. In the **Publish agent** dialog, resolve any reported readiness or policy issues.
3. Select **Publish** to confirm and wait for success.

The solution includes the **Inject conversation ID** workflow and its hook binding. If workflow activation failed during import, resolve the reported error and publish the workflow before publishing the agent. Do not rebuild the hook.

References: [publish an agent](https://learn.microsoft.com/en-us/microsoft-copilot-studio/agents-experience/publication-publish-agent), [hooks and workflow publication](https://learn.microsoft.com/en-us/microsoft-copilot-studio/agents-experience/hooks-overview).

## 6. Install the Teams app through ATK

Your organization's policy must allow custom app installation for the test account.

Install ATK and sign in to the same tenant used for the relay:

```sh
npm install --global @microsoft/m365agentstoolkit-cli@1.1.19
atk auth login m365 --tenant YOUR_TENANT_GUID
```

Run the command for your hosting option:

```sh
# Local relay
npm run install:teams -- --target local --approve-install

# Azure-hosted relay
npm run install:teams -- --target azure --approve-install
```

The command registers and uploads the generated app through ATK, then prints a Teams link. Open that link with the test account and complete **Add** and any sign-in or consent prompts. No manual ZIP upload is required by this path.

This Teams app connects customers to the **relay**. Do not substitute a Teams package downloaded directly from Copilot Studio.

## 7. Open the console and test handover

The relay serves the mock support console; no separate console process is needed.

| Hosting option | Open in a browser |
|---|---|
| Local | `http://127.0.0.1:3978/support.html`, on the computer running step 3A |
| Azure | The App Service URL from step 3B followed by `/support.html` |

1. In Teams, send a normal support question, then ask for a human.
2. In the console, claim the queued chat and reply as the human support representative.
3. Include a distinctive fact, then select **Return to assistant**.
4. Confirm the Copilot Studio agent immediately resumes in Teams and uses that fact.

Test handover through Teams, not the Copilot Studio **Preview** pane: the relay must establish the conversation mapping.

## Troubleshooting

| Symptom | Check |
|---|---|
| Solution import fails | Import the connector package first. Use **Download Log File** on the failed import for missing dependencies or permissions. |
| Connector connection is missing | Create its No authentication connection and select it in `cpshnd_handover_escalation`. |
| Escalation cannot reach the relay | Confirm the relay/tunnel is running and **Host** matches its current public hostname. |
| Escalation returns 404 | Test through the relay's Teams app; Studio Preview conversations have no relay mapping. |
| Teams app cannot be found | Check the ATK account/tenant and rerun step 6. Open the newly printed link. |
| Sign-in or consent fails | Confirm test-user access to the agent and consent for `CopilotStudio.Copilots.Invoke`. Do not disable Bot authentication. |
| Azure B1 quota is unavailable | Use the local option or request quota for the selected Azure region. |

For a reachability check, run `npm run test:smoke -- --target local` or `--target azure`. This does not replace the Teams handover test.

## Rebuild the solution packages

The exploded solution source is in `sourcecode/connector/` and `sourcecode/agent/`. After editing it, rebuild with the [Power Platform CLI](https://learn.microsoft.com/en-us/power-platform/developer/cli/reference/solution#pac-solution-pack):

```sh
pac solution pack --folder sourcecode/connector --zipfile solution/CopilotStudioHandoverConnector_1_0_0_0.zip --packagetype Unmanaged
pac solution pack --folder sourcecode/agent --zipfile solution/CopilotStudioHandover_1_0_0_0.zip --packagetype Unmanaged
```

## Stop and clean up

For local hosting, press Ctrl+C in the relay terminal. This stops local processes, not cloud resources.

When finished, uninstall the Teams app, remove only the sample-owned Azure and Entra resources, and delete synthetic conversation data. Deleting an unmanaged solution removes its container, not the imported components; review those separately.
