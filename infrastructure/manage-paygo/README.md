---
title: PAYG Billing Policy Management
parent: Infrastructure
nav_order: 2
---
# PAYG Billing Policy Management for Power Platform

New
{: .label .label-green }

Companion artifacts for the blog post **"Herding Clouds: Taming Pay-As-You-Go Billing Policies in Power Platform at Scale"**.

This folder contains everything you need to follow along end-to-end: a bulk-assignment script, an Azure Automation runbook, a test harness, sample webhook data, and the importable Power Automate solution.

---

## Folder Structure

```
manage-paygo/
├── scripts/
│   ├── bulk-assign-billing-policy.ps1      # Bulk-link environments to billing policies via CSV
│   ├── UnlinkBillingPolicyRunbook.ps1      # Azure Automation runbook (triggered by budget alert)
│   └── TestRunbook.ps1                     # Manual runbook trigger for end-to-end testing
├── samples/
│   └── Webhooktestdata.json                # Simulated Azure Monitor budget alert payload
└── solution/
    └── BillingPolicyManagement_1_0_0_3.zip # Importable Power Automate solution
```

---

## Prerequisites

| Requirement | Details |
|---|---|
| **Azure CLI** | Installed and authenticated (`az login`) |
| **PowerShell 7+** | Required to run the scripts |
| **Azure Automation Account** | With a System-Assigned Managed Identity |
| **Power Platform role** | Power Platform Admin, Global Admin, or Dynamics 365 Admin |
| **Power Automate environment** | To import the solution into |

{: .note }
> **Permissions:** The Automation Account's Managed Identity only needs permission to call the Power Automate HTTP trigger (token audience: `https://service.flow.microsoft.com/`). The Power Platform Admin permissions are held by the connection credentials configured inside the Power Automate solution — those connections must be authenticated by an account with Power Platform Admin rights.

---

## Scripts

### `bulk-assign-billing-policy.ps1`

Bulk-assigns Power Platform environments to billing policies from a CSV file. Runs in six stages: verifies Azure CLI login, validates the CSV, resolves billing policies by name, resolves environment IDs by display name (with tenant-wide pagination for large tenants), links each environment to its policy, and writes results back to the CSV.

**CSV format expected:**

```csv
EnvironmentName,EnvironmentID,BillingPolicyName,Status
Sales-Production,,ProductionBillingPolicy,
Marketing-Sandbox,a1b2c3d4-e5f6-...,DevBillingPolicy,
HR-Production,,ProductionBillingPolicy,
```

- `EnvironmentID` is optional — the script resolves it from `EnvironmentName` if blank.
- `Status` is populated by the script after each run (`Succeeded` or `Failed: <reason>`).
- Only **Production** and **Sandbox** environments are eligible. Developer, Trial, and Default types are skipped with a clear status message.

**Usage:**

```powershell
# Preview what would happen — always run this first
.\bulk-assign-billing-policy.ps1 -InputFile ".\environments.csv" -DryRun

# Execute for real
.\bulk-assign-billing-policy.ps1 -InputFile ".\environments.csv"
```

---

### `UnlinkBillingPolicyRunbook.ps1`

An Azure Automation runbook that acts as the bridge between an Azure Budget alert and the Power Automate unlinking flow. Intended to be hosted in an Azure Automation Account and triggered via webhook from an Azure Action Group.

**What it does:**
1. Parses the incoming Azure Monitor Common Alert Schema webhook payload
2. Extracts the subscription ID and resource group from the `alertId` path
3. Authenticates using the Automation Account's Managed Identity (`Connect-AzAccount -Identity`)
4. Acquires a bearer token for the Power Automate service endpoint
5. POSTs the subscription and resource group context to the Power Automate HTTP trigger flow

**Before deploying, update the hardcoded values:**

| Line | Variable | What to replace with |
|---|---|---|
| 27 | `$Url` | The HTTP trigger URL from your imported Power Automate solution (found in the flow's trigger details) |

```powershell
# Line 27 — replace with your own flow trigger URL
$Url = "https://<your-environment>.environment.api.powerplatform.com/powerautomate/..."
```

---

### `TestRunbook.ps1`

Manually triggers the `UnlinkBillingPolicies` runbook with a local test payload file — so you can validate the entire chain end-to-end without waiting for an actual budget breach.

**Before running, update the hardcoded values at the top of the file:**

| Variable | Description |
|---|---|
| `$SubscriptionId` | Your Azure subscription ID |
| `$AutomationAccountName` | Your Automation Account name |
| `$ResourceGroupName` | Resource group hosting the Automation Account |
| `$RunbookName` | Name of the runbook as deployed in the Automation Account |

**Usage:**

```powershell
.\TestRunbook.ps1
```

This triggers the runbook with the payload from `../samples/Webhooktestdata.json`. The runbook parses it, calls Power Automate, and the flow unlinks all environments from the matching billing policy — full end-to-end, no real spend required.

---

## Samples

### `Webhooktestdata.json`

A realistic Azure Monitor Common Alert Schema payload simulating a budget threshold breach. Used by `TestRunbook.ps1` to trigger the runbook manually.

**Simulated scenario:**
- Budget name: `prodbilling`
- Monthly budget: `$2.00`
- Alert threshold: `$1.60` (80%)
- Simulated spend: `$4.00` (200%)

The `alertId` field in this payload encodes a real subscription ID and resource group (`Azurevnetforpowerplatform`). The runbook extracts these to identify which billing policy to act on. **Update this file** if your test environment uses a different subscription or resource group.

---

## Solution

### `BillingPolicyManagement_1_0_0_3.zip`

| Property | Value |
|---|---|
| **Unique Name** | BillingPolicyManagement |
| **Display Name** | Billing Policy Management Demo |
| **Version** | 1.0.0.3 |
| **Publisher** | MCS CAT (`mcscat`) |
| **Type** | Unmanaged |

An importable Power Automate solution containing **2 custom connectors** and **3 cloud flows**:

#### Custom Connectors

| Connector | Host | API Version | Operations |
|---|---|---|---|
| **Azure Usage** (`mcscat_azureusage`) | `management.azure.com` | `2025-03-01` | `Query_Usage` — POST to `/{scope}/providers/Microsoft.CostManagement/query` to retrieve cost/usage data |
| **Power Platform Billing Policy** (`mcscat_powerplatformbilliinpolicy`) | `api.powerplatform.com` | `2022-03-01-preview` | `ListBillingPolicies`, `GetBillingPolicy`. Auth: OAuth 2.0 (`https://api.powerplatform.com/.default`) |

#### Cloud Flows

| Flow | Trigger | Description |
|---|---|---|
| **Poll Cost and Unlink Environments** | Recurrence (every 4 hours) | Queries Azure Cost Management for actual costs. If pre-tax cost exceeds **$65**, invokes the unlinking child flow. |
| **UnlinkAllEnvironmentsFromResourceGroup** | HTTP POST (child flow) | Lists billing policies, finds matches by subscription/resource group, unlinks environments. Returns audit log. |
| **UnlinkAllEnvironmentsFromBillingPolicy** | Manual (Button) | Matches billing policy by name, unlinks all linked environments. Returns audit log. |

#### Connection References

| Logical Name | Connector |
|---|---|
| `mcscat_sharedazureusage…` | Azure Usage (custom) |
| `mcscat_sharedpowerplatformbilliinpolicy…` | Power Platform Billing Policy (custom) |
| `new_sharedpowerplatformadminv2_498a1` | Power Platform Admin V2 (standard) |

**To deploy:**
1. Import the solution into a Power Platform environment where the connection owner has Power Platform Admin rights
2. Authenticate the three connectors during import (Azure Usage, Power Platform Billing Policy, Power Platform Admin V2)
3. Update the `QueryScope` variable in the *Poll Cost and Unlink Environments* flow to target your Azure subscription/resource group
4. Adjust the cost threshold (default: **$65**) in the same flow if needed
5. Copy the HTTP trigger URL from the *UnlinkAllEnvironmentsFromResourceGroup* flow
6. Paste that URL into `UnlinkBillingPolicyRunbook.ps1` at line 27
7. Turn on the scheduled *Poll Cost and Unlink Environments* flow

---

## End-to-End Flow

```
environments.csv
       │
       ▼
bulk-assign-billing-policy.ps1
Environments linked to billing policies
       │
       │   (later, when spend threshold is crossed)
       ▼
Azure Budget Alert → Action Group → Automation Account webhook
       │
       ▼
UnlinkBillingPolicyRunbook.ps1
Parses alert → gets token via Managed Identity → calls Power Automate
       │
       ▼
BillingPolicyManagement solution
Finds policy by name → loops environments → unlinks each one
Environments unlinked — audit log returned
```

To test the right half of this chain at any time, run `TestRunbook.ps1` with `Webhooktestdata.json` — no real budget breach required.
