# Workday Employee Request Time Off

## Overview
This scenario enables employees to submit time off requests directly through the Copilot agent. It collects the necessary information (date, hours, type, and reason) via an Adaptive Card form and submits the request to Workday's Absence Management system.

## Features

- **Automatic Input Extraction**: If user includes date, hours, or reason in their request, they're automatically extracted
- **Time Off Types**: Supports multiple time off types (Vacation, Sick, Floating Holiday)
- **Validation**: Form validation ensures all required fields are provided
- **Access Control**: Verifies the user can only request time off for themselves
- **Cancel Support**: User can cancel the request before submission

## Files

| File | Description |
|------|-------------|
| `topic.yaml` | Copilot Studio topic definition with trigger phrases, Adaptive Card form, and submission logic |
| `msdyn_HRWorkdayAbsenceEnterTimeOff_EnterTimeOffInfo.xml` | XML template for Workday Enter_Time_Off API call |

## Prerequisites

### Global Variables Required
- `Global.ESS_UserContext_Employee_Id` - The employee's Workday Employee ID

### Environment Variables
- `Env.WorkdayWebsiteRedirectMessage` - Optional message shown after successful submission (e.g., link to Workday portal)

### Workday API
- **Service**: Absence_Management
- **Operation**: Enter_Time_Off
- **Version**: v42.0

## Workflow

```
┌─────────────────────────────────────┐
│   User triggers topic               │
│   (e.g., "Request time off")        │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Access Check                      │
│   (Verify user is requesting for   │
│    themselves only)                 │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Display Time Off Form             │
│   (Adaptive Card with pre-filled    │
│    values if provided in request)   │
└──────────────┬──────────────────────┘
               │
               ▼
        ┌──────┴──────┐
        │  Cancel?    │
        └──────┬──────┘
               │
       ┌───────┴───────┐
       │               │
       ▼               ▼
┌──────────────┐ ┌──────────────┐
│ End dialog   │ │ Submit to    │
│ with cancel  │ │ Workday API  │
│ message      │ │              │
└──────────────┘ └──────┬───────┘
                        │
                        ▼
                 ┌──────┴──────┐
                 │  Success?   │
                 └──────┬──────┘
                        │
                ┌───────┴───────┐
                │               │
                ▼               ▼
         ┌──────────────┐ ┌──────────────┐
         │ Show error   │ │ Show success │
         │ message      │ │ message      │
         └──────────────┘ └──────────────┘
```

## Trigger Phrases

- "Request time off"
- "I need to submit time off"
- "Please request 8 hours time off on 2025-09-15 because of a family event"
- "Request 4 hours vacation on December 1st"
- "Submit vacation request"
- "I want to take a day off"

## Topic Input Parameters

The topic supports automatic extraction of these parameters from the user's request:

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `TimeOffDate` | DateTime | Date of time off (yyyy-mm-dd) | `2026-01-30` |
| `NumberOfHours` | Number | Number of hours requested | `8` |
| `ReasonText` | String | Free text reason for time off | `Family event` |
| `EmployeeName` | String | Name mentioned (used for access check) | `John Smith` |

## Adaptive Card Form Fields

| Field | Type | Required | Validation | Default |
|-------|------|----------|------------|---------|
| Type of Time Off | Dropdown | Yes | Must select one | - |
| Date | Date Picker | Yes | Cannot be in the past | Pre-filled if provided |
| Number of Hours | Number Input | Yes | Min: 0.5, Max: 24 | 8 hours |
| Reason | Text Input | Yes | Max 500 characters | Pre-filled if provided |

### Supported Time Off Types

| Display Name | Value (Time_Off_Type_ID) |
|--------------|--------------------------|
| Floating Holiday | `Floating_Holiday_Hours` |
| Vacation | `Vacation_Hours` |
| Sick | `Sick_Hours` |

> **Note**: To add more time off types, update the `choices` array in the `timeOffType` Input.ChoiceSet within the Adaptive Card in `topic.yaml`.

## XML Template Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `{Employee_ID}` | Employee's Workday ID | `21514` |
| `{Time_Off_Date}` | Date of time off (YYYY-MM-DD) | `2026-01-30` |
| `{Hours}` | Number of hours requested | `8` |
| `{Reason_ID}` | Time Off Type ID | `Vacation_Hours` |
| `{Comment}` | Reason/comment text | `Family event` |

## Response Data

| Field | Description | XPath |
|-------|-------------|-------|
| WID | Workday Internal ID of the created time off event | `//*[local-name()='Time_Off_Event_Reference']/*[local-name()='ID' and @type='WID']` |

## Business Process Configuration

The XML template configures the Workday business process with:

| Setting | Value | Description |
|---------|-------|-------------|
| `Auto_Complete` | false | Request goes through approval workflow |
| `Run_Now` | true | Submit immediately |
| `Discard_On_Exit_Validation_Error` | true | Discard if validation fails |

## Example Interactions

### Example 1: Basic Request
**User**: "I want to request time off"

**Agent** displays form:
> **Request Time Off**
> Enter the date, hours, and reason for your time off request.
> 
> Type of Time Off: [Dropdown]  
> Date: [Date Picker]  
> Number of Hours: [8]  
> Reason: [Text Input]  
> 
> [Submit] [Cancel]

**User** fills form and submits

**Agent**: "Your time off request has been submitted."

---

### Example 2: Pre-filled Request
**User**: "Request 4 hours vacation on January 30th for a doctor's appointment"

**Agent** displays form with pre-filled values:
> Type of Time Off: [Dropdown]  
> Date: [2026-01-30]  
> Number of Hours: [4]  
> Reason: [doctor's appointment]

---

### Example 3: Cancelled Request
**User** clicks Cancel

**Agent**: "Your request has been cancelled. Is there anything else you need help with?"

## Setup Instructions

1. **Import the Topic**: Import `topic.yaml` into your Copilot Studio agent
2. **Add XML Template**: Upload `msdyn_HRWorkdayAbsenceEnterTimeOff_EnterTimeOffInfo.xml` to your Workday connector configuration
3. **Configure Connection**: Ensure your Workday connector connection reference is properly set in the topic
4. **Set Global Variable**: Make sure `Global.ESS_UserContext_Employee_Id` is populated from user authentication
5. **Configure Environment Variable** (Optional): Set `Env.WorkdayWebsiteRedirectMessage` for post-submission guidance

## Dependencies

- `msdyn_copilotforemployeeselfservicehr.topic.WorkdaySystemAccessCheck` - Verifies user access permissions
- `msdyn_copilotforemployeeselfservicehr.topic.WorkdaySystemGetCommonExecution` - Common API execution topic
- `Global.ESS_UserContext_Employee_Id` - Current user's employee ID

## Model Instructions

The topic includes model instructions to:
- Only respond to requests for the user's own time off
- Reject requests to submit time off for other employees
- Prompt for input if date, hours, or reason are missing

### Invalid Requests (Rejected)
- "Request time off for my manager"
- "Request time off for my sister"
- "Request time off for [EmployeeName]"

### Valid Requests (Accepted)
- "Request time off"
- "I need to submit time off"
- "Please request 8 hours time off on 2025-09-15 because of a family event"
- "Request 4 hours vacation on December 1st"

## Customization Guide

### Adding Time Off Types
In `topic.yaml`, locate the `timeOffType` dropdown in the Adaptive Card and add new choices:

```yaml
choices: [
    { title: "Floating Holiday", value: "Floating_Holiday_Hours" },
    { title: "Vacation", value: "Vacation_Hours" },
    { title: "Sick", value: "Sick_Hours" },
    # Add your custom time off type:
    { title: "Bereavement", value: "Bereavement_Hours" }
]
```

### Changing Hour Limits
Modify the `min` and `max` values in the `numberOfHours` input:

```yaml
{
  type: "Input.Number",
  id: "numberOfHours",
  min: 0.5,   # Minimum hours
  max: 24,    # Maximum hours
  ...
}
```

### Enabling Auto-Complete
To skip the approval workflow, change `Auto_Complete` to `true` in the XML template:

```xml
<wd:Auto_Complete>true</wd:Auto_Complete>
```
