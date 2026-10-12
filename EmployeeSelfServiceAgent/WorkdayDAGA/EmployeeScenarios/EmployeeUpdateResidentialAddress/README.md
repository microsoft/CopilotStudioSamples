---
nav_exclude: true
search_exclude: false
---
# Workday Employee Update Residential Address

## Overview

This topic enables employees to manage their home/residential address in Workday through the Copilot agent. It retrieves the employee's current home addresses, allows them to select which one to update, add a new address, or modify an existing one, and submits the changes via the Workday Change Home Contact Information API.

## Features

- View current home addresses with primary address marked
- Update any field of an existing home address
- Add a new home address when no addresses exist or user wants to add another
- Set or change which address is the primary home address
- Form pre-population with current address values

## Snapshots

![Update Residential Address](update_address.png)

## Trigger Phrases

- "Update my home address"
- "I want to update my residential address"
- "Change my address"
- "Update my street address"
- "I moved to a new address"

## Files

| File | Description |
|------|-------------|
| `topic.yaml` | Copilot Studio topic definition with conversation flow |
| `template-config-partial.yaml` | The Workday request templates this topic calls, as `SetVariable` actions plus the lookup rows that register them |

## Setup

Import `topic.yaml`, then make both edits from `template-config-partial.yaml` in the **Workday [System] - 1: Set Runtime Template Configurations** topic:

1. Paste its `SetVariable` actions under `beginDialog` > `actions`.
2. Add the `{ Key: ..., Value: ... }` rows listed at the end of the file to the `Global.ESS_WorkdayHCM_Template_Configurations` action.

{: .warning }
> Skipping step 2 leaves the template set but never resolved, so the Workday call silently returns blank.

## Workday APIs Used

| API | Purpose |
|-----|---------|
| `Get_Workers` | Retrieve current home address information |
| `Change_Home_Contact_Information` | Add or update home address |

## Flow Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    User Triggers Topic                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│           Fetch Current Home Addresses                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│     Show Selection (Multiple) or Auto-Select (Single)       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│        Collect New Address via Adaptive Card Form            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Submit to Workday                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│           Show Success/Error Message                         │
└─────────────────────────────────────────────────────────────┘
```

## Configurations

Environment makers need to configure the following in the topic:

| Configuration | Description | Location in Topic |
|---------------|-------------|-------------------|
| **Countries** | Available country options (USA, CAN, GBR, etc.) | Adaptive card dropdown |
| **States/Provinces** | Available state/province codes per country | Adaptive card dropdown |
| **Workday Icon** | Update the icon URL to match your organization's branding | Topic properties > Icon |
| **Workday URL** | Set your organization's Workday tenant URL | HTTP action or connector configuration |

## Dependencies

- **Employee Context**: Worker ID must be available in the conversation context
