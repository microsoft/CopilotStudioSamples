# Salesforce Integration - Copilot Studio

## Project Overview

This project contains Apex classes and deployment scripts for integrating Microsoft Copilot Studio with Salesforce Einstein Bots via the DirectLine API.

**Related repositories:**
- **Samples**: `/Users/administrator/projects/CopilotStudioSamples/IntegrateWithEngagementHub/Salesforce/`
- **Documentation**: `/Users/administrator/projects/docs/businessapps-copilot-docs-pr/copilot-studio/customer-copilot-salesforce-handoff.md`

---

## Important Notes

### Agentforce Support Removed (February 2026)

Agentforce integration code was removed from the repo because there is no reliable integration path at this time. The research findings below are preserved as institutional knowledge for if/when Agentforce integration becomes viable.

#### Original Agentforce Accommodation (February 2026)

We had added full support for Salesforce Agentforce alongside the existing Einstein Bots support, but removed it due to the lack of a reliable integration path.

#### Key Research Findings

| Aspect | Einstein Bots | Agentforce |
|--------|--------------|------------|
| **Permission Set** | `sfdc_chatbot_service_permset` (auto-created) | Custom permission set assigned to `EinsteinServiceAgent` user |
| **User Model** | Uses system permission set | Auto-generated user per agent (format: `EinsteinServiceAgent-[AgentId]`) |
| **Fallback Mechanism** | **Confused** topic | **Fallback** topic |
| **AI Architecture** | Rule-based (NLU) | LLM-based (generative) |
| **Prerequisites** | Service Cloud License | Einstein Copilot + Data Cloud |

**Critical finding:** The same Apex `@InvocableMethod` classes work with both platforms. The integration code is identical—only the permission configuration and topic names differ.

#### What We Changed

**1. MS Learn Documentation** (`customer-copilot-salesforce-handoff.md`)

- Updated title: "Integrate with Salesforce Einstein Bot or Agentforce"
- Added introduction explaining both platforms are supported
- Added MS Learn tabs (`# [Einstein Bots](#tab/einsteinBots)` / `# [Agentforce](#tab/agentforce)`) to:
  - Prerequisites (different license requirements)
  - Step 5: Grant permissions (different permission set approach)
  - Step 6: Set up bot/agent (different setup locations)
  - Step 7: Connect to Copilot Studio (Confused vs Fallback topic)
  - Step 8: Handle agent handoff (different escalation docs)
- Added new Step 4: Configure Named Credential (was missing from original doc)
- Steps 1-4 remain unchanged (identical for both platforms)

**2. Deployment Scripts**

`grant-bot-permissions.sh` / `grant-bot-permissions.ps1`:
- Added `--agentforce` / `-Agentforce` flag
- Added `--agent-name` / `-AgentName` optional filter
- Agentforce mode:
  - Creates `CopilotStudio_DirectLine` permission set
  - Queries for `EinsteinServiceAgent` users via SOQL
  - Auto-assigns permission set if single agent found
  - Lists agents if multiple found (requires `--agent-name` filter)

`deploy.sh` / `deploy.ps1`:
- Added `--agentforce` / `-Agentforce` flag
- Added `--agent-name` / `-AgentName` pass-through
- Shows mode at startup
- Links to correct MS Learn tab in output

**3. README Updates**

- Updated intro to mention both platforms
- Added Quick Start examples for both modes
- Updated "What Gets Deployed" to explain both modes
- Renamed "Agentforce Compatibility" to "Agentforce Support" (now fully automated)

#### Agentforce Agent Creation Order

**Important:** The Agentforce agent must be created in the Salesforce UI *before* the script can assign permissions to it. The `EinsteinServiceAgent` user is auto-generated when you create an Agentforce agent.

**Recommended workflow:**
1. Run `deploy.sh --agentforce` to deploy metadata and create permission set
2. Create Agentforce agent in Salesforce Setup → Agents
3. Re-run `grant-bot-permissions.sh --agentforce` to assign permission set to agent user

**Alternative:** Manually assign the `CopilotStudio_DirectLine` permission set to your agent's user in Setup → Users.

#### SOQL Queries for Agentforce

```sql
-- Find EinsteinServiceAgent users
SELECT Id, Username FROM User WHERE Username LIKE 'EinsteinServiceAgent%' LIMIT 10

-- Filter by agent name
SELECT Id, Username FROM User WHERE Username LIKE 'EinsteinServiceAgent%' AND Name LIKE '%AgentName%' LIMIT 10

-- Check permission set assignment
SELECT Id FROM PermissionSetAssignment WHERE AssigneeId = 'userId' AND PermissionSetId = 'permsetId'
```

#### API Limitation: SetupEntityType

The `SetupEntityType` field on `SetupEntityAccess` is read-only via the API. When creating access records, omit this field - Salesforce auto-determines the type from `SetupEntityId`.

#### MS Learn Tab Syntax

```markdown
# [Einstein Bots](#tab/einsteinBots)

Content for Einstein Bots...

# [Agentforce](#tab/agentforce)

Content for Agentforce...

---
```

Tab IDs are used in URLs: `?tabs=einsteinBots` or `?tabs=agentforce`

---

## File Structure

```
Salesforce/
├── ApexClasses/
│   ├── DL_GetConversation.cls    # Starts DirectLine conversation
│   ├── DL_PostActivity.cls       # Sends user message to Copilot Studio
│   └── DL_GetActivity.cls        # Retrieves bot response (with polling)
├── Metadata/
│   ├── classes/                  # Apex class metadata XML
│   ├── remoteSiteSettings/       # DirectLine remote site
│   ├── externalCredentials/      # Directline External Credential
│   └── namedCredentials/         # Directline Named Credential
├── scripts/
│   ├── deploy.sh                 # Main deployment (macOS/Linux)
│   ├── deploy.ps1                # Main deployment (Windows)
│   ├── grant-bot-permissions.sh  # Permission grant (macOS/Linux)
│   └── grant-bot-permissions.ps1 # Permission grant (Windows)
├── README.md
└── CLAUDE.md                     # This file
```

---

## Usage Examples

```bash
# Deploy everything (Einstein Bots)
./scripts/deploy.sh

# Just grant permissions (skip deployment)
./scripts/grant-bot-permissions.sh
```

---

## Links

- [MS Learn Documentation](https://learn.microsoft.com/en-us/microsoft-copilot-studio/customer-copilot-salesforce-handoff)
- [Einstein Bots Tab](https://learn.microsoft.com/en-us/microsoft-copilot-studio/customer-copilot-salesforce-handoff?tabs=einsteinBots)
- [Agentforce Tab](https://learn.microsoft.com/en-us/microsoft-copilot-studio/customer-copilot-salesforce-handoff?tabs=agentforce)
- [Salesforce Einstein Bots Docs](https://help.salesforce.com/s/articleView?language=en_US&id=sf.bots_service_enhanced.htm&type=5)
- [Salesforce Agentforce Docs](https://help.salesforce.com/s/articleView?id=sf.copilot_intro.htm&type=5)
