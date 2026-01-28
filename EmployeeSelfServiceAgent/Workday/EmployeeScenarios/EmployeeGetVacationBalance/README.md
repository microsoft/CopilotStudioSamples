# Workday Get Vacation Balance

## Overview
This scenario enables employees to view their time off plan balances from Workday. It retrieves vacation, sick leave, and other time off balances for a specified effective date and presents them in a user-friendly format.

## Features

- **Date Selection**: Prompts user to select an as-of date via Adaptive Card (defaults to today)
- **Automatic Date Detection**: If user includes a date in their request, it's automatically extracted
- **Multiple Plans**: Displays all time off plan balances (vacation, sick leave, PTO, etc.)
- **AI-Formatted Response**: Uses AI to format the response in a friendly, readable way

## Files

| File | Description |
|------|-------------|
| `topic.yaml` | Copilot Studio topic definition with trigger phrases and Power Fx logic |
| `msdyn_HRWorkdayHCMEmployeeGetVacationBalance.xml` | XML template for Workday Get_Time_Off_Plan_Balances API call |

## Prerequisites

### Global Variables Required
- `Global.ESS_UserContext_Employee_Id` - The employee's Workday Employee ID

### Workday API
- **Service**: Absence_Management
- **Operation**: Get_Time_Off_Plan_Balances
- **Version**: v42.0

## Workflow

```
┌─────────────────────────────────────┐
│   User triggers topic               │
│   (e.g., "What is my vacation       │
│   balance?")                        │
└──────────────┬──────────────────────┘
               │
               ▼
        ┌──────┴──────┐
        │ Date in     │
        │ request?    │
        └──────┬──────┘
               │
       ┌───────┴───────┐
       │               │
       ▼               ▼
┌──────────────┐ ┌──────────────┐
│ Use provided │ │ Show date    │
│ date         │ │ picker card  │
└──────┬───────┘ └──────┬───────┘
       │                │
       └───────┬────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Call Workday API                  │
│   (Get_Time_Off_Plan_Balances)      │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   AI formats response               │
│   (Friendly, user-focused)          │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Display vacation balances         │
└─────────────────────────────────────┘
```

## Trigger Phrases

- "What is my vacation balance?"
- "How much time off can I take?"
- "What is my workday vacation balance?"
- "Show my PTO balance"
- "How many vacation days do I have left?"

## Data Retrieved

| Field | Description | XPath |
|-------|-------------|-------|
| RemainingBalance | Available balance for the time off plan | `.//Time_Off_Plan_Balance/text()` |
| PlanDescriptor | Name of the time off plan (e.g., "Vacation", "Sick Leave") | `.//Time_Off_Plan_Reference/@Descriptor` |
| PlanID | Unique identifier for the plan (hidden from user) | `.//ID[@type='Absence_Plan_ID']/text()` |
| UnitOfTime | Unit of measurement (Hours, Days) | `.//Unit_of_Time_Reference/@Descriptor` |

## XML Template Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `{Employee_ID}` | Employee's Workday ID | `21514` |
| `{As_Of_Effective_Date}` | Date to check balance (YYYY-MM-DD) | `2026-01-28` |

## Topic Input Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `AsOfEffectiveDate` | DateTime | No | The effective date for balance lookup. If not provided, user is prompted to select a date. |

## Adaptive Card: Date Picker

The topic displays an Adaptive Card with a date picker when no date is provided:

| Element | Type | Default Value |
|---------|------|---------------|
| Date Selector | Input.Date | Today's date |
| Submit Button | Action.Submit | "Submit" |

## AI Response Formatting

The response is formatted by AI with these instructions:
- Display each vacation balance on a separate line
- Highlight the vacation plan name
- Include the as-of date in the response
- Never include the Plan ID
- Format in a friendly, conversational way
- Tie response back to the user's original question

## Example Interaction

**User**: "What is my vacation balance?"

**Agent** displays date picker card:
> Which date would you like to check your vacation balance for?
> [Date: 2026-01-28] [Submit]

**User** submits with selected date

**Agent**:
> As of **January 28, 2026**, here are your time off balances:
> 
> **Vacation**: 80 Hours  
> **Sick Leave**: 40 Hours  
> **Personal Time**: 16 Hours

## Setup Instructions

1. **Import the Topic**: Import `topic.yaml` into your Copilot Studio agent
2. **Add XML Template**: Upload `msdyn_HRWorkdayHCMEmployeeGetVacationBalance.xml` to your Workday connector configuration
3. **Configure Connection**: Ensure your Workday connector connection reference is properly set in the topic
4. **Set Global Variable**: Make sure `Global.ESS_UserContext_Employee_Id` is populated (typically from user authentication context)

## Dependencies

- `msdyn_copilotforemployeeselfservicehr.topic.WorkdaySystemGetCommonExecution` - Common API execution topic
- `Global.ESS_UserContext_Employee_Id` - Current user's employee ID

## Model Instructions

The topic includes model instructions to:
- Only respond to requests about the user's own vacation balance
- Reject requests about other employees' balances
- Retrieve data exclusively from Workday

### Invalid Requests (Rejected)
- "What is my manager's vacation balance?"
- "What is my sister's vacation balance?"
- "Show [EmployeeName]'s PTO balance"

### Valid Requests (Accepted)
- "What is my vacation balance?"
- "How much time off can I take?"
- "What is my workday vacation balance?"
