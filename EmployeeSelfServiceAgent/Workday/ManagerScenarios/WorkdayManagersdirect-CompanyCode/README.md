# Workday Managers Direct Reports - Company Code

## Overview
This scenario enables managers to view the company code and company name for their direct reports. It retrieves organization data from Workday and presents it as a nested markdown list, with optional filtering by employee name.

## Features

- **Direct Reports Only**: Retrieves company information for employees who report directly to the manager
- **Manager Verification**: Validates that the requesting user is a manager before proceeding
- **Name Filtering**: Optionally filter results by a specific employee's name
- **Markdown Output**: Results formatted as a nested markdown list for easy reading

## Files

| File | Description |
|------|-------------|
| `topic.yaml` | Copilot Studio topic definition with trigger phrases and data transformation logic |
| `msdyn_HRWorkdayHCMManagerDirectCompanyCode.xml` | XML template for Workday Get_Workers API call with organization data |

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
│   (e.g., "What are the company      │
│   codes for my reports?")           │
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
│   (Worker IDs, Names, Company info) │
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

- "Show me my team's company codes"
- "What are the company codes for my reports?"
- "What company codes are mapped to my team members?"
- "What is the company code for [EmployeeName]?"

## Topic Input Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `EmployeeName` | String | Optional. Filter results to a specific employee by name. |

## Data Retrieved

| Field | Description | Example |
|-------|-------------|---------|
| FirstName | Employee's first name | `John` |
| LastName | Employee's last name | `Smith` |
| CompanyCode | Organization company code | `CORP001` |
| CompanyName | Organization company name | `Contoso Corporation` |

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
    <bsvc:Exclude_Companies>false</bsvc:Exclude_Companies>
    <bsvc:Include_Personal_Information>true</bsvc:Include_Personal_Information>
    <bsvc:Include_Employment_Information>true</bsvc:Include_Employment_Information>
</bsvc:Response_Group>
```

## Response Properties Extracted

| Key | XPath | Description |
|-----|-------|-------------|
| WorkerID | `//*[local-name()='Worker_ID']/text()` | Employee's worker ID |
| FirstName | `//*[local-name()='First_Name']/text()` | First name |
| LastName | `//*[local-name()='Last_Name']/text()` | Last name |
| CompanyCode | `...Organization_Data/Organization_Code` (filtered by Company subtype) | Company code |
| CompanyName | `...Organization_Data/Organization_Name` (filtered by Company subtype) | Company name |

## Example Interactions

### Example 1: All Direct Reports
**User**: "What are the company codes for my reports?"

**Agent**:
```
Here are the company codes for your direct reports:

- **John Smith**
  - Company Code: CORP001
  - Company Name: Contoso Corporation

- **Jane Doe**
  - Company Code: CORP002
  - Company Name: Contoso International

- **Bob Johnson**
  - Company Code: CORP001
  - Company Name: Contoso Corporation
```

---

### Example 2: Specific Employee
**User**: "What is the company code for Jane Doe?"

**Agent**:
```
- **Jane Doe**
  - Company Code: CORP002
  - Company Name: Contoso International
```

---

### Example 3: Employee Not Found
**User**: "What is the company code for Alice?"

**Agent**: "It looks like you don't have access to this information. Try making a new request."

## Setup Instructions

1. **Import the Topic**: Import `topic.yaml` into your Copilot Studio agent
2. **Add XML Template**: Upload `msdyn_HRWorkdayHCMManagerDirectCompanyCode.xml` to your Workday connector configuration
3. **Configure Connection**: Ensure your Workday connector connection reference is properly set in the topic
4. **Set Global Variable**: Make sure `Global.ESS_UserContext_ManagerOrganizationId` is populated from user authentication

## Dependencies

- `msdyn_copilotforemployeeselfservicehr.topic.WorkdayManagerCheck` - Verifies user is a manager
- `msdyn_copilotforemployeeselfservicehr.topic.WorkdaySystemGetCommonExecution` - Common API execution topic
- `Global.ESS_UserContext_ManagerOrganizationId` - Manager's organization ID

## Model Instructions

The topic includes model instructions to:
- Only respond to requests about direct reports' company information
- Output results as a nested markdown list
- Reject requests about non-direct-reports (managers, siblings, etc.)

### Invalid Requests (Rejected)
- "What is my manager's company code?"
- "What is my sister's company code?"
- "What is my own company code?"

### Valid Requests (Accepted)
- "What is the company code of my direct reports?"
- "What are the company codes for my reports?"
- "What is the company code for [EmployeeName]?" (if they are a direct report)

## Output Type

The topic outputs a `workdayResponseTable` table:

```yaml
workdayResponseTable:
  - FirstName: String      # e.g., "John"
    LastName: String       # e.g., "Smith"
    CompanyCode: String    # e.g., "CORP001"
    CompanyName: String    # e.g., "Contoso Corporation"
```
