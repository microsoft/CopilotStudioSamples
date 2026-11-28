---
title: a2a CLI and coding agents
parent: A2A Protocol
grand_parent: Extensibility
nav_order: 3
---
# Call a Copilot Studio agent from the a2a CLI and coding agents

Copilot Studio can expose a published agent on the **A2A client** channel. This sample connects the open source [`a2a` CLI](https://github.com/a2aproject/a2a-cli) from the A2A project to that channel, and through the CLI's `a2a-cli` plugin, coding agents such as [GitHub Copilot CLI](https://docs.github.com/copilot/how-tos/use-copilot-agents/use-copilot-cli). Your terminal, or the coding agent working in it, can then hand a question to your Copilot Studio agent and get its answer back.

There is no code to build: one PowerShell script registers the Entra app the CLI signs in with, and a small configuration file does the rest. For an SDK-based client, see [Copilot Studio protocol clients](../../copilotstudio-protocol-clients/).

{: .note }
> The A2A client channel is in preview. Calls to the agent, including the ones a coding agent makes for you, can consume Copilot Credits.

## Prerequisites

- A published Copilot Studio agent in an [early release cycle environment](https://learn.microsoft.com/power-platform/admin/early-release), where the A2A client channel is available.
- [PowerShell 7](https://learn.microsoft.com/powershell/scripting/install/installing-powershell) and the [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli), signed in to the agent's tenant with permission to create app registrations. Granting consent for the whole tenant needs an administrator.
- The `a2a` CLI, v0.5.0 or later. On Windows, `winget install a2aproject.a2acli`. On macOS or Linux:

  ```bash
  brew tap a2aproject/a2a-cli https://github.com/a2aproject/a2a-cli
  brew install a2a
  ```

- Optional: GitHub Copilot CLI, to let a coding agent call your agent.

## 1. Copy the Agent Card URL

1. Open your published agent in Copilot Studio.
2. On the **Build** tab, add the **A2A client** channel. Depending on the Copilot Studio build, it's listed under **Channels** or under **Triggers**.
3. Copy the **Agent Card URL**, which ends in `/.well-known/agent-card.json`, and select **Done**.

{: .tip }
> If your environment is on the early release cycle but **A2A client** isn't listed, open the same agent from [copilotstudio.preview.microsoft.com](https://copilotstudio.preview.microsoft.com).

Use the **Agent Card URL**, not the **URL** above it. The card is public and tells the CLI which interface to call and how to sign in. Given the agent's URL instead, `a2a` asks it for a card and gets `405 Method Not Allowed`.

## 2. Register the client app

The Copilot Studio channel accepts Entra ID tokens issued to an app registered in your tenant. Run [New-A2AClientApp.ps1](./New-A2AClientApp.ps1) from this folder:

```powershell
./New-A2AClientApp.ps1 -TenantId <tenant-id> -GrantAdminConsent
```

It creates the app registration, or updates the one with the same name, and writes `~/.config/a2a-cli/config.yaml`. If that file already exists, the script prints the lines to add instead of changing it. Leave out `-GrantAdminConsent` if an administrator grants consent for you.

The app has the delegated permission `MCS.InvokeAsA2A` on the Copilot Studio channel API (`6f46e6ed-07bf-4616-80f0-47546850f654`). The other settings are there because, without each one, sign-in fails with the error in the last column.

| Setting | Value | Error without it |
|---|---|---|
| Redirect URI, mobile and desktop platform | `http://127.0.0.1/oauth/callback`. Entra ignores the port of a loopback redirect. | `AADSTS50011` |
| Allow public client flows | Yes, for `a2a auth login --device` | `AADSTS7000218` |
| `omit_resource: true` in `config.yaml` | Leaves out the RFC 8707 `resource` parameter, which Entra rejects alongside scopes | `AADSTS9010010` |
| `oauth-clients` entry in `config.yaml` | The app's client ID, for the tenant's authorization server | `no client in oauth-clients matches the authorization server` |

The resulting configuration looks like this:

```yaml
oauth: cached
oauth-clients:
  - authority: https://login.microsoftonline.com/<tenant-id>/v2.0
    client_id: <application-id>
    omit_resource: true
```

`oauth: cached` lets every `a2a` command use the stored sign-in without asking again, which is what a coding agent needs.

## 3. Sign in

```powershell
$card = '<Agent Card URL>'
a2a auth login $card --scope https://api.powerplatform.com/copilotstudio-a2a/MCS.InvokeAsA2A --scope offline_access
```

`a2a` prints a sign-in URL to open in a browser. Add `--device` to get a code to enter on any device instead.

Ask for `offline_access` together with the scope the card names, as above. The card names only `MCS.InvokeAsA2A`, and without `offline_access` Entra returns no refresh token, so the sign-in lasts about an hour. `a2a auth list` shows the stored sign-in.

## 4. Send a message

```powershell
a2a send -a $card "Who are you, and how early should I leave Lausanne for a 9:00 flight from Geneva airport?"
```

The agent's reply comes back as a completed task:

```text
Task:     a24667992091443eb16dfe5b98d76c6d
Context:  42a7c68ba61441389aba29284d5cb44d
Status:   completed (2026-11-28T16:32:02Z)
  I'm Trip Helper, a Copilot Studio agent reached over the Agent2Agent protocol, and I help the
  Lausanne travel team plan business trips. For a 9:00 flight, take a train from Lausanne at
  about 6:15-6:30. [...]
```

## 5. Let GitHub Copilot CLI call your agent

Install the `a2a-cli` plugin, which teaches the coding agent to use the `a2a` CLI:

```bash
copilot plugin marketplace add a2aproject/agent-plugins
copilot plugin install a2a-cli@a2a-plugins
```

Then ask for the agent by its card URL. Allowing only the `a2a` command keeps the coding agent to that:

```powershell
copilot -p "Use the a2a-cli skill. Ask the A2A agent whose card is at $card what three things I should pack for a two-day business trip to Zurich in December, and show me its reply." --allow-tool 'shell(a2a)' --allow-tool 'shell(a2a:*)'
```

Copilot CLI loads the skill, runs `a2a send` with the card URL, and relays the Copilot Studio agent's answer (abridged):

```text
● skill(a2a-cli)
$ a2a send -a "https://api.powerplatform.com/copilotstudio-a2a/tenants/.../.well-known/agent-card.json"
  --timeout 120s "What three things should I pack for a two-day business trip to Zurich in December?"

> For two days in Zurich in December, I'd pack these three things:
> 1. A warm, smart winter coat. [...]
> 2. Waterproof shoes with good grip. [...]
> 3. Your travel documents and a charged phone with the SBB Mobile app. [...]
```

The [coding agents guide](https://github.com/a2aproject/a2a-cli/blob/main/docs/guide/coding-agents.md) has the install commands for other coding agents.

## Troubleshooting

| Symptom | Fix |
|---|---|
| **A2A client** isn't listed in Copilot Studio | Check that the environment is on the early release cycle, then open the agent from copilotstudio.preview.microsoft.com. |
| `card request failed, status: 405` | Pass the **Agent Card URL**, not the agent's URL. |
| `no client in oauth-clients matches the authorization server` | `config.yaml` has no `oauth-clients` entry for the tenant. Run the script again, or add the entry by hand. |
| `AADSTS9010010` | Set `omit_resource: true` on the `oauth-clients` entry. |
| `AADSTS50011` | Add the redirect URI `http://127.0.0.1/oauth/callback` to the app registration. |
| `AADSTS7000218` with `--device` | Allow public client flows on the app registration. |
| Sign-in needed again after an hour | Sign in again with `--scope offline_access`, as in step 3. |
| `The Copilot Studio channel API is not in this tenant yet` from the script | Open the A2A client channel on a published agent once, then run the script again. |
