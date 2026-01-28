# Workday Manager Service Anniversary

## Overview
This scenario enables managers to view upcoming service anniversaries for their direct reports. It retrieves hire dates from Workday, calculates upcoming anniversary dates and milestones, and presents the information as a markdown table.

## Features

- **Anniversary Calculation**: Automatically calculates upcoming service anniversary dates from hire dates
- **Milestone Tracking**: Shows how many years each employee will be celebrating
- **Next Month Filter**: Ability to filter for anniversaries happening next month
- **Manager Verification**: Validates that the requesting user is a manager before proceeding
- **Name Filtering**: Optionally filter results by a specific employee's name
- **Markdown Table Output**: Results formatted as a clean markdown table

## Files

| File | Description |
|------|-------------|
| `topic.yaml` | Copilot Studio topic definition with trigger phrases and anniversary calculation logic |
| `msdyn_HRWorkdayHCMManagerServiceAnniversary.xml` | XML template for Workday Get_Workers API call with employment data |

## Prerequisites

### Global Variables Required
- `Global.ESS_UserContext_ManagerOrganizationId` - The manager's organization ID in Workday

### Workday API
- **Service**: Human_Resources
- **Operation**: Get_Workers
- **Version**: v41.0

## Workflow

```
┌─────────────────────────────────────┐
│   User triggers topic               │
│   (e.g., "When are my team's        │
│   service anniversaries?")          │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Manager Check                     │
│   (Verify user is a manager)        │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Call Get_Workers API              │
│   (Filter by manager's org)         │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Parse Response                    │
│   (Names, Hire Dates)               │
└──────────────┬──────────────────────┘
               │
               ▼
        ┌──────┴──────┐
        │ Employee    │
        │ name given? │
        └──────┬──────┘
               │
       ┌───────┴───────┐
       │               │
       ▼               ▼
┌──────────────┐ ┌──────────────┐
│ Filter by    │ │ Include all  │
│ employee name│ │ direct       │
│              │ │ reports      │
└──────┬───────┘ └──────┬───────┘
       │                │
       └───────┬────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Calculate Anniversary Data        │
│   - Upcoming Anniversary Date       │
│   - Upcoming Milestone (years)      │
│   - Anniversary Month               │
│   - Is Anniversary Next Month?      │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Return as markdown table          │
└─────────────────────────────────────┘
```

## Trigger Phrases

- "When are the service anniversaries of all my directs?"
- "What are the service anniversaries of my entire team?"
- "Show me the service anniversaries of my reports"
- "What are the upcoming service anniversaries of my team?"
- "Any upcoming service anniversaries of my reports?"
- "Show me service anniversaries of my directs"
- "What is [EmployeeName]'s next service anniversary?"
- "When is [EmployeeName]'s next year service anniversary?"

## Topic Input Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `EmployeeName` | String | Optional. Filter results to a specific employee by name. |
| `duration` | Number | Optional. Duration for calculating nth service anniversary date. |

## Data Retrieved from Workday

| Field | Description | XPath |
|-------|-------------|-------|
| WorkerID | Employee's worker ID | `//*[local-name()='Worker_ID']/text()` |
| FirstName | First name | `//*[local-name()='First_Name']/text()` |
| LastName | Last name | `//*[local-name()='Last_Name']/text()` |
| HireDate | Original hire date | `//*[local-name()='Hire_Date']/text()` |

## Calculated Fields

| Field | Description | Example |
|-------|-------------|---------|
| EmployeeName | Full name (FirstName + LastName) | `John Smith` |
| HireDate | Original hire date | `2020-03-15` |
| UpcomingServiceAnniversaryDate | Next anniversary date | `2026-03-15` |
| UpcomingMilestone | Number of years at next anniversary | `6` |
| AnniversaryMonth | Month number of anniversary | `3` |
| isAnniversaryNextMonth | Boolean flag for filtering | `true` / `false` |

## Anniversary Calculation Logic

The topic uses Power Fx formulas to calculate upcoming anniversaries:

```
UpcomingServiceAnniversaryDate = 
  If Today() <= this year's anniversary date
    Then this year's anniversary
    Else next year's anniversary

UpcomingMilestone = Years between HireDate and UpcomingServiceAnniversaryDate
```

## XML Template Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `{ManagerOrgId}` | Manager's organization reference ID | `ORG-12345` |
| `{As_Of_Effective_Date}` | Current date (YYYY-MM-DD) | `2026-01-28` |

## Response Group Configuration

The XML template requests employment and personal information:

```xml
<bsvc:Response_Group>
    <bsvc:Include_Employment_Information>true</bsvc:Include_Employment_Information>
    <bsvc:Include_Personal_Information>true</bsvc:Include_Personal_Information>
</bsvc:Response_Group>
```

## Example Interactions

### Example 1: All Direct Reports
**User**: "When are the service anniversaries of all my directs?"

**Agent**:

| Employee Name | Hire Date | Upcoming Service Anniversary Date | Upcoming Milestone |
|---------------|-----------|-----------------------------------|-------------------|
| John Smith | 2020-03-15 | 2026-03-15 | 6 years |
| Jane Doe | 2019-07-22 | 2026-07-22 | 7 years |
| Bob Johnson | 2022-01-10 | 2026-01-10 | 4 years |

---

### Example 2: Specific Employee
**User**: "What is Jane Doe's next service anniversary?"

**Agent**:

| Employee Name | Hire Date | Upcoming Service Anniversary Date | Upcoming Milestone |
|---------------|-----------|-----------------------------------|-------------------|
| Jane Doe | 2019-07-22 | 2026-07-22 | 7 years |

---

### Example 3: Next Month Filter
**User**: "Any service anniversaries next month?"

**Agent** (uses `isAnniversaryNextMonth` to filter):

| Employee Name | Hire Date | Upcoming Service Anniversary Date | Upcoming Milestone |
|---------------|-----------|-----------------------------------|-------------------|
| Bob Johnson | 2022-02-15 | 2026-02-15 | 4 years |

---

### Example 4: Employee Not Found
**User**: "What is Alice's service anniversary?"

**Agent**: "It looks like you don't have access to this information. Try making a new request."

## Setup Instructions

1. **Import the Topic**: Import `topic.yaml` into your Copilot Studio agent
2. **Add XML Template**: Upload `msdyn_HRWorkdayHCMManagerServiceAnniversary.xml` to your Workday connector configuration
3. **Configure Connection**: Ensure your Workday connector connection reference is properly set in the topic
4. **Set Global Variable**: Make sure `Global.ESS_UserContext_ManagerOrganizationId` is populated from user authentication

## Dependencies

- `msdyn_copilotforemployeeselfservicehr.topic.WorkdayManagerCheck` - Verifies user is a manager
- `msdyn_copilotforemployeeselfservicehr.topic.WorkdaySystemGetCommonExecution` - Common API execution topic
- `Global.ESS_UserContext_ManagerOrganizationId` - Manager's organization ID

## Model Instructions

The topic includes model instructions to:
- Output results as a markdown table with columns: Employee Name, Hire Date, Upcoming Service Anniversary Date, Upcoming Milestone
- Use `isAnniversaryNextMonth` to filter when user asks about "next month"
- Default to showing future anniversaries unless otherwise specified
- Reject requests about non-direct-reports

### Invalid Requests (Rejected)
- "What is my manager's service anniversary?"
- "What is my sister's hire date?"

### Valid Requests (Accepted)
- "What is the service anniversary of my direct reports?"
- "What is [EmployeeName]'s next service anniversary?"
- "Any upcoming service anniversaries next month?"

## Output Type

The topic outputs a `response` table:

```yaml
response:
  - EmployeeName: String                    # e.g., "John Smith"
    HireDate: Date                          # e.g., 2020-03-15
    UpcomingServiceAnniversaryDate: Date    # e.g., 2026-03-15
    UpcomingMilestone: Number               # e.g., 6
    AnniversaryMonth: Number                # e.g., 3
    isAnniversaryNextMonth: Boolean         # e.g., false
```
