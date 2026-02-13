# Request Time Off

This scenario allows employees to submit time off requests to Workday, supporting single-day or multi-day date ranges with automatic balance display.

## Overview

The `WorkdayEmployeeRequestTimeOff` topic allows employees to:
1. **View** their current leave balances (vacation, sick, floating holiday)
2. **Submit** time off requests for a date range
3. **Choose** the type of leave and hours per day

## Flow

```
┌─────────────────────────────────────┐
│   User triggers topic               │
│   "Request time off"                │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Fetch current leave balances      │
│   (msdyn_HRWorkdayHCMEmployee       │
│    GetVacationBalance)              │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Display Adaptive Card Form        │
│   - Shows available balances        │
│   - Time off type dropdown          │
│   - Start date / End date           │
│   - Hours per day                   │
└──────────────┬──────────────────────┘
               │
               ▼
        ┌──────┴──────┐
        │  User       │
        │  Action?    │
        └──────┬──────┘
               │
       ┌───────┼───────┐
       │       │       │
       ▼       ▼       ▼
┌──────────┐ ┌──────────┐ ┌──────────────┐
│ Cancel   │ │ Type Not │ │ Submit       │
│          │ │ Listed   │ │              │
└────┬─────┘ └────┬─────┘ └──────┬───────┘
     │            │              │
     ▼            ▼              ▼
┌──────────┐ ┌──────────┐ ┌──────────────┐
│ End      │ │ Redirect │ │ Validate     │
│ Dialog   │ │ to       │ │ Dates        │
└──────────┘ │ Workday  │ └──────┬───────┘
             └──────────┘        │
                                 ▼
                    ┌────────────────────────┐
                    │ Build date list        │
                    │ (loop: start → end)    │
                    └────────────┬───────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │ Submit to Workday      │
                    │ (msdyn_HRWorkday       │
                    │  AbsenceEnterTimeOff   │
                    │  _MultiDay)            │
                    └────────────┬───────────┘
                                 │
                         ┌───────┴───────┐
                         │               │
                         ▼               ▼
                    ┌──────────┐   ┌──────────────┐
                    │ Success  │   │ Error        │
                    │ Card     │   │ (AI-friendly │
                    │          │   │  message)    │
                    └──────────┘   └──────────────┘
```

## API Scenarios Used

| Scenario | API | Purpose |
|----------|-----|---------|
| `msdyn_HRWorkdayHCMEmployeeGetVacationBalance` | Human_Resources | Fetch current leave balances |
| `msdyn_HRWorkdayAbsenceEnterTimeOff_MultiDay` | Absence_Management v42.0 | Submit time off request |

## Features

### Intelligent Leave Type Mapping
User input is automatically mapped to leave types using configurable keywords:

| User Says | Maps To |
|-----------|---------|
| "vacation", "annual", "pto", "holiday pay" | Vacation_Hours |
| "floating", "floater", "float day" | Floating_Holiday_Hours |
| "sick", "illness", "medical", "unwell" | Sick_Hours |

## Form Fields

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| Type of time off | Dropdown | Yes | Auto-mapped | Vacation, Floating holiday, Sick leave |
| Start date | Date Input | Yes | From user query | First day of time off |
| End date | Date Input | Yes | From user query | Last day of time off |
| Hours per day | Number Input | Yes | 8 | Hours to deduct per day |

## Input Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `InputStartDate` | DateTime | Pre-fill start date from user query |
| `InputEndDate` | DateTime | Pre-fill end date from user query |
| `InputHoursPerDay` | Number | Pre-fill hours per day |
| `InputTimeOffType` | String | Natural language leave type (e.g., "vacation", "sick") |

## XML Template Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `{Employee_ID}` | Employee's Workday ID | `21514` |
| `{timeoff_Dates}` | Comma-separated list of dates | `2025-09-15,2025-09-16,2025-09-17` |
| `{timeoff_Time_Off_Type}` | Time off type ID | `Vacation_Hours` |
| `{timeoff_Hours_Per_Day}` | Hours per day | `8` |
| `{timeoff_Comment}` | Comment for the request | `ess generated time off request` |

## Configuration

### Leave Type Configuration
Edit the `LeaveTypeConfig` variable to customize keyword-to-leave-type mappings:

```yaml
- kind: SetVariable
  id: set_leave_type_config
  variable: Topic.LeaveTypeConfig
  value: |-
    =Table(
      {Keywords: "vacation,annual,pto,holiday pay", LeaveTypeValue: "Vacation_Hours"},
      {Keywords: "floating,floater,float day", LeaveTypeValue: "Floating_Holiday_Hours"},
      {Keywords: "sick,illness,medical,unwell,not feeling well", LeaveTypeValue: "Sick_Hours"}
    )
```

### Plan Balance Configuration
Edit the `PlanConfig` variable to map Workday Plan IDs to display names:

```yaml
- kind: SetVariable
  id: set_plan_config
  variable: Topic.PlanConfig
  value: |-
    =Table(
      {PlanID: "PTO_USA", DisplayName: "Paid time off"},
      {PlanID: "FH_USA", DisplayName: "Floating holiday"},
      {PlanID: "ABSENCE_PLAN-6-159", DisplayName: "Sick leave"},
      {PlanID: "ABSENCE_PLAN-6-158", DisplayName: "Vacation"}
    )
```

### Workday URL Configuration
Update the `WorkdayUrl` variable to point to your Workday tenant:

```yaml
- kind: SetVariable
  id: set_workday_url
  variable: Topic.WorkdayUrl
  value: https://impl.workday.com/<TENANT_NAME>/home.htmld
```

## Example Triggers

**Valid requests:**
- "Request time off"
- "I need to submit time off"
- "Please request vacation from January 5th to January 10th"
- "Request sick leave for next week"
- "I need time off from 2025-09-15 to 2025-09-20 for a family event"
- "Book 4 hours of PTO tomorrow"
