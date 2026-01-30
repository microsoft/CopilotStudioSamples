# Workday Managers Direct Reports - Job Taxonomy

## Overview
This scenario enables managers to view the job taxonomy information for their direct reports. It retrieves job-related data including job title, business title, job profile, and job family from Workday, with human-readable job family names resolved from reference data.

## Features

- **Direct Reports Only**: Retrieves job taxonomy for employees who report directly to the manager
- **Manager Verification**: Validates that the requesting user is a manager before proceeding
- **Reference Data Resolution**: Converts Job Family IDs to human-readable names
- **Name Filtering**: Optionally filter results by a specific employee's name
- **Markdown Output**: Results formatted as a nested markdown list for easy reading

## Files

| File | Description |
|------|-------------|
| `topic.yaml` | Copilot Studio topic definition with trigger phrases and data transformation logic |
| `msdyn_HRWorkdayHCMManagerJobTaxonomy.xml` | XML template for Workday Get_Workers API call with employment data |

## Prerequisites

### Global Variables Required
- `Global.ESS_UserContext_ManagerOrganizationId` - The manager's organization ID in Workday

### Reference Data Lookup Tables
The topic automatically refreshes this lookup table if empty:
- `Global.JobFamilyLookupTable` - Job family names by Job_Family_ID

### Workday API
- **Service**: Human_Resources
- **Operation**: Get_Workers
- **Version**: v41.0

## Workflow

```
┌─────────────────────────────────────┐
│   User triggers topic               │
│   (e.g., "Show me my team's job     │
│   titles")                          │
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
│   (Names, Job Titles, Profiles)     │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Refresh Job Family Reference Data │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Transform Data with Lookups       │
│   (Resolve Job Family IDs to names) │
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

- "Show me my team's job title"
- "What is the internal title of my direct report [EmployeeName]?"
- "What is the job function of my team?"
- "What job profile is mapped to my team members?"
- "What are the external titles of my team members?"
- "Show me my team's job taxonomy"
- "Get job data for [EmployeeName]"
- "What is the job title of [EmployeeName]?"

## Topic Input Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `EmployeeName` | String | Optional. Filter results to a specific employee by name. |

## Data Retrieved

| Field | Description | Example |
|-------|-------------|---------|
| FirstName | Employee's first name | `John` |
| LastName | Employee's last name | `Smith` |
| JobTitle | Internal position title | `Senior Software Engineer` |
| BusinessTitle | External-facing title | `Software Engineer III` |
| JobProfile | Job profile classification | `Software Engineering` |
| JobFamily | Job family grouping | `Engineering & Technology` |

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

## Response Properties Extracted

| Key | XPath | Description |
|-----|-------|-------------|
| WorkerID | `//*[local-name()='Worker_ID']/text()` | Employee's worker ID |
| FirstName | `//*[local-name()='First_Name']/text()` | First name |
| LastName | `//*[local-name()='Last_Name']/text()` | Last name |
| JobTitle | `//*[local-name()='Position_Title']/text()` | Internal job title |
| BusinessTitle | `//*[local-name()='Business_Title']/text()` | Business/external title |
| JobProfile | `//*[local-name()='Job_Profile_Name']/text()` | Job profile name |
| JobFamilyId | `//*[local-name()='Job_Family_Reference']/*[local-name()='ID']` | Job family ID (for lookup) |

## Example Interactions

### Example 1: All Direct Reports
**User**: "Show me my team's job titles"

**Agent**:
```
Here is the job taxonomy for your direct reports:

- **John Smith**
  - Job Title: Senior Software Engineer
  - Business Title: Software Engineer III
  - Job Profile: Software Engineering
  - Job Family: Engineering & Technology

- **Jane Doe**
  - Job Title: Product Manager
  - Business Title: Senior Product Manager
  - Job Profile: Product Management
  - Job Family: Product & Design

- **Bob Johnson**
  - Job Title: QA Engineer
  - Business Title: Quality Assurance Engineer
  - Job Profile: Quality Assurance
  - Job Family: Engineering & Technology
```

---

### Example 2: Specific Employee
**User**: "What is the job title of Jane Doe?"

**Agent**:
```
- **Jane Doe**
  - Job Title: Product Manager
  - Business Title: Senior Product Manager
  - Job Profile: Product Management
  - Job Family: Product & Design
```

---

### Example 3: Employee Not Found
**User**: "What is the job title for Alice?"

**Agent**: "It looks like you don't have access to this information. Try making a new request."

## Setup Instructions

1. **Import the Topic**: Import `topic.yaml` into your Copilot Studio agent
2. **Add XML Template**: Upload `msdyn_HRWorkdayHCMManagerJobTaxonomy.xml` to your Workday connector configuration
3. **Configure Connection**: Ensure your Workday connector connection reference is properly set in the topic
4. **Set Global Variable**: Make sure `Global.ESS_UserContext_ManagerOrganizationId` is populated from user authentication
5. **Reference Data**: Ensure reference data topic is configured for Job Family lookups

## Dependencies

- `msdyn_copilotforemployeeselfservicehr.topic.WorkdayManagerCheck` - Verifies user is a manager
- `msdyn_copilotforemployeeselfservicehr.topic.WorkdaySystemGetCommonExecution` - Common API execution topic
- `msdyn_copilotforemployeeselfservicehr.topic.WorkdaySystemRefreshReferenceData` - Reference data refresh
- `Global.ESS_UserContext_ManagerOrganizationId` - Manager's organization ID
- `Global.JobFamilyLookupTable` - Job family reference data

## Model Instructions

The topic includes model instructions to:
- Only respond to requests about direct reports' job taxonomy
- Output results as a nested markdown list
- Reject requests about non-direct-reports (managers, siblings, etc.)
- Only provide data when sufficient information is available

### Invalid Requests (Rejected)
- "What is my manager's job function?"
- "What is my sister's job title?"
- "What is my own job title?"

### Valid Requests (Accepted)
- "What is the external title of my direct reports?"
- "What is [EmployeeName]'s job title?"
- "Show me my team's job taxonomy"

## Output Type

The topic outputs a `workdayResponseTable` table:

```yaml
workdayResponseTable:
  - FirstName: String      # e.g., "John"
    LastName: String       # e.g., "Smith"
    JobTitle: String       # e.g., "Senior Software Engineer"
    BusinessTitle: String  # e.g., "Software Engineer III"
    JobProfile: String     # e.g., "Software Engineering"
    JobFamily: String      # e.g., "Engineering & Technology"
```
