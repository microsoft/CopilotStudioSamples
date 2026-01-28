# Workday Managers Direct Reports - Cost Center

## Overview
This scenario enables managers to view the cost center information for their direct reports. It retrieves organization data from Workday and presents cost center codes and names as a nested markdown list, with optional filtering by employee name.

## Features

- **Direct Reports Only**: Retrieves cost center information for employees who report directly to the manager
- **Manager Verification**: Validates that the requesting user is a manager before proceeding
- **Name Filtering**: Optionally filter results by a specific employee's name
- **Markdown Output**: Results formatted as a nested markdown list for easy reading

## Files

| File | Description |
|------|-------------|
| `topic.yaml` | Copilot Studio topic definition with trigger phrases and data transformation logic |
| `msdyn_HRWorkdayHCMManagerDirectCostCenter.xml` | XML template for Workday Get_Workers API call with organization data |

## Prerequisites

### Global Variables Required
- `Global.ESS_UserContext_ManagerOrganizationId` - The manager's organization ID in Workday

### Workday API
- **Service**: Human_Resources
- **Operation**: Get_Workers
- **Version**: v42.0

## Workflow

```
┌─────────────────────────────────────┐
│   User triggers topic               │
│   (e.g., "What is the cost center   │
│   of my direct reports?")           │
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
│   (Worker IDs, Names, Cost Center)  │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Transform to Table                │
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
│ Filter by    │ │ Return all   │
│ employee name│ │ direct       │
│              │ │ reports      │
└──────────────┘ └──────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Return as nested markdown list    │
└─────────────────────────────────────┘
```

## Trigger Phrases

- "Show me my team's cost center data"
- "What cost centers are assigned to my reports?"
- "What are my team's cost centers?"
- "What is the cost center for [EmployeeName]?"

## Topic Input Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `EmployeeName` | String | Optional. Filter results to a specific employee by name. |

## Data Retrieved

| Field | Description | Example |
|-------|-------------|---------|
| FirstName | Employee's first name | `John` |
| LastName | Employee's last name | `Smith` |
| CostCenterCode | Cost center code | `CC-1001` |
| CostCenterName | Cost center name | `Engineering - West` |

## XML Template Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `{ManagerOrgId}` | Manager's organization reference ID | `ORG-12345` |
| `{As_Of_Effective_Date}` | Current date (YYYY-MM-DD) | `2026-01-28` |

## Response Group Configuration

The XML template requests organization and personal information:

```xml
<bsvc:Response_Group>
    <bsvc:Include_Organizations>true</bsvc:Include_Organizations>
    <bsvc:Exclude_Cost_Centers>false</bsvc:Exclude_Cost_Centers>
    <bsvc:Include_Personal_Information>true</bsvc:Include_Personal_Information>
    <bsvc:Include_Employment_Information>true</bsvc:Include_Employment_Information>
</bsvc:Response_Group>
```

## Response Properties Extracted

| Key | XPath | Description |
|-----|-------|-------------|
| WorkerID | `//*[local-name()='Worker_ID']/text()` | Employee's worker ID |
| LegalNameData | `//*[local-name()='Legal_Name_Data']` | Name data including first/last name |
| CostCenterCode | `...Organization_Data/Organization_Code` (filtered by Cost_Center type) | Cost center code |
| CostCenterName | `...Organization_Data/Organization_Name` (filtered by Cost_Center type) | Cost center name |
| PositionID | `//*[local-name()='Position_ID']/text()` | Position identifier |

## Example Interactions

### Example 1: All Direct Reports
**User**: "What are my team's cost centers?"

**Agent**:
```
Here are the cost centers for your direct reports:

- **John Smith**
  - Cost Center Code: CC-1001
  - Cost Center Name: Engineering - West

- **Jane Doe**
  - Cost Center Code: CC-2002
  - Cost Center Name: Product Development

- **Bob Johnson**
  - Cost Center Code: CC-1001
  - Cost Center Name: Engineering - West
```

---

### Example 2: Specific Employee
**User**: "What is the cost center for Jane Doe?"

**Agent**:
```
- **Jane Doe**
  - Cost Center Code: CC-2002
  - Cost Center Name: Product Development
```

---

### Example 3: Employee Not Found
**User**: "What is the cost center for Alice?"

**Agent**: "It looks like you don't have access to this information. Try making a new request."

## Setup Instructions

1. **Import the Topic**: Import `topic.yaml` into your Copilot Studio agent
2. **Add XML Template**: Upload `msdyn_HRWorkdayHCMManagerDirectCostCenter.xml` to your Workday connector configuration
3. **Configure Connection**: Ensure your Workday connector connection reference is properly set in the topic
4. **Set Global Variable**: Make sure `Global.ESS_UserContext_ManagerOrganizationId` is populated from user authentication

## Dependencies

- `msdyn_copilotforemployeeselfservicehr.topic.WorkdayManagerCheck` - Verifies user is a manager
- `msdyn_copilotforemployeeselfservicehr.topic.WorkdaySystemGetCommonExecution` - Common API execution topic
- `Global.ESS_UserContext_ManagerOrganizationId` - Manager's organization ID

## Model Instructions

The topic includes model instructions to:
- Only respond to requests about direct reports' cost center information
- Output results as a nested markdown list
- Reject requests about non-direct-reports (managers, siblings, etc.)
- Only provide data when sufficient information is available

### Invalid Requests (Rejected)
- "What is my manager's cost center?"
- "What is my sister's cost center?"
- "What is my own cost center?"

### Valid Requests (Accepted)
- "What is the cost center of my direct reports?"
- "What cost centers are assigned to my reports?"
- "What is the cost center for [EmployeeName]?" (if they are a direct report)

## Output Type

The topic outputs a `workdayResponseTable` table:

```yaml
workdayResponseTable:
  - FirstName: String        # e.g., "John"
    LastName: String         # e.g., "Smith"
    CostCenterCode: String   # e.g., "CC-1001"
    CostCenterName: String   # e.g., "Engineering - West"
```
