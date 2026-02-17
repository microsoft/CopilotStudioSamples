# Workday Employee Request Time Off

## Overview

This topic enables employees to submit time off requests through a conversational interface with their Copilot Studio agent. Employees can request single-day or multi-day time off by specifying dates and selecting from available time off types (e.g., vacation, sick leave, personal time).

## Features

- Request single-day or multi-day time off
- Display available time off types dynamically from Workday
- Validate date inputs for business logic compliance
- Submit time off requests directly to Workday
- Confirmation of successful submission

## Snapshots

<!-- Add conversation flow screenshots here -->

## Trigger Phrases

- "I want to request time off"
- "Submit time off request"
- "I need to take some time off"
- "Request vacation"
- "Book time off"

## Files

| File | Description |
|------|-------------|
| `topic.yaml` | Copilot Studio topic definition with conversation flow |
| `msdyn_HRWorkdayAbsenceEnterTimeOff_MultiDay.xml` | Workday API request template for multi-day time off |

## Workday APIs Used

| API | Purpose |
|-----|---------|
| `Get_Time_Off_Types` | Retrieves available time off types for the employee |
| `Enter_Time_Off` | Submits the time off request to Workday |

## Flow Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    User Triggers Topic                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Collect Start Date from User                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│               Collect End Date from User                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│         Fetch Time Off Types via Workday Connector           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│           Display Time Off Types for Selection               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│            Submit Time Off Request to Workday                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Confirm Submission to User                      │
└─────────────────────────────────────────────────────────────┘
```

## Configurations

Environment makers need to configure the following in the topic:

| Configuration | Description | Location in Topic |
|---------------|-------------|-------------------|
| **Time Off Plans** | Configure which time off plans to display balances for | Global variable or condition node |
| **Time Off Types** | Define the available time off types for selection | Adaptive card or choice options |
| **Workday Icon** | Update the icon URL to match your organization's branding | Topic properties > Icon |
| **Workday URL** | Set your organization's Workday tenant URL | HTTP action or connector configuration |

## Dependencies

- **msdyn_HRWorkdayHCMEmployeeGetVacationBalance template**: Required for fetching available time off types
- **Employee Context**: Worker ID must be available in the conversation context
