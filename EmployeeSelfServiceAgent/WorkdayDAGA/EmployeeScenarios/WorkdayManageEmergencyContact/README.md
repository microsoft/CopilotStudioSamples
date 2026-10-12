---
nav_exclude: true
search_exclude: false
---
# Workday Manage Emergency Contact

## Overview

This topic enables employees to manage their emergency contacts in Workday through a conversational interface. Employees can view existing contacts, add new emergency contacts, update existing ones, and delete contacts they no longer need.

## Features

- View existing emergency contacts with primary contact highlighted
- Add new emergency contacts with full details
- Update details of existing emergency contacts
- Delete non-primary emergency contacts
- Set or change the primary emergency contact
- Assign priority levels (2-10) to contacts

## Snapshots

![Manage Emergency Contact](update_emergency_contact.png)

![Emergency Contact Form](update_emergency_contact_2.png)

## Trigger Phrases

- "Manage my emergency contacts"
- "Update my emergency contact"
- "Add emergency contact"
- "Change my emergency contact information"
- "Delete my emergency contact"
- "Show my emergency contacts"

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
| `Get_Workers` | Retrieve employee's existing emergency contacts |
| `Change_Emergency_Contacts` | Add, update, or delete emergency contact information |

## Flow Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    User Triggers Topic                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│      Fetch Reference Data (Country Codes, Relationships)    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Fetch Existing Emergency Contacts               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│     Show Selection Card (or Go to Add if no contacts)        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│          Show Add/Update Form (Adaptive Card)                │
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
| **Relationship Types** | Available relationship options from Workday reference data | Dynamic from GetReferenceData |
| **Country Codes** | Phone country codes from Workday reference data | Dynamic from GetReferenceData |
| **States/Provinces** | Available state/province codes per country | Adaptive card dropdown |
| **Workday Icon** | Update the icon URL to match your organization's branding | Topic properties > Icon |
| **Workday URL** | Set your organization's Workday tenant URL | HTTP action or connector configuration |

## Dependencies

- **Employee Context**: Worker ID must be available in the conversation context
