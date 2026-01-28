# Workday Employees View Their Job Taxonomy

## Overview
This scenario enables employees to view their job taxonomy information from Workday. It retrieves job-related data including job title, business title, job profile, and job family, providing employees with visibility into their role classification within the organization.

## Features

- **Multiple Job Attributes**: Retrieves job title, business title, job profile, and job family
- **Two-Step Retrieval**: First fetches employee job data, then enriches with job family details
- **Real-Time Data**: Uses current date as effective date for up-to-date information
- **AI Response**: Returns structured data that AI formats based on the user's specific question

## Files

| File | Description |
|------|-------------|
| `topic.yaml` | Copilot Studio topic definition with trigger phrases and data transformation logic |
| `msdyn_HRWorkdayHCMEmployeeGetJobTaxonomy.xml` | XML template for Workday Get_Workers API call to retrieve job taxonomy |

> **Note**: This scenario also uses `msdyn_HRWorkdayHCMEmployeeGetJobTaxonomyGeneric` (a shared template) to fetch job family details in a second API call. This template is part of the common ESS configuration.

## Prerequisites

### Global Variables Required
- `Global.ESS_UserContext_Employee_Id` - The employee's Workday Employee ID
- `Global.ESS_UserContext_Employee_Firstname` - Employee's first name
- `Global.ESS_UserContext_Employee_Lastname` - Employee's last name

### Workday API
- **Service**: Human_Resources
- **Operation**: Get_Workers
- **Version**: v42.0

## Workflow

```
┌─────────────────────────────────────┐
│   User triggers topic               │
│   (e.g., "What is my job title?")   │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Call Get_Workers API              │
│   (msdyn_HRWorkdayHCMEmployee       │
│    GetJobTaxonomy)                  │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Parse Response                    │
│   (JobTitle, BusinessTitle,         │
│    JobProfile, JobFamilyId)         │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Call Get Job Family API           │
│   (msdyn_HRWorkdayHCMEmployee       │
│    GetJobTaxonomyGeneric)           │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Parse Job Family Name             │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Combine into Job Taxonomy Data    │
│   and return to AI for response     │
└─────────────────────────────────────┘
```

## Trigger Phrases

- "What is my job title?"
- "What job function do I belong to?"
- "What is my job function?"
- "What job category do I belong to?"
- "What is my role?"
- "What job family do I belong to?"
- "What is my job profile?"
- "What is my internal title?"
- "What is my external title?"

## Data Retrieved

### Step 1: Employee Job Data

| Field | Description | XPath |
|-------|-------------|-------|
| JobTitle | Position title (internal title) | `//*[local-name()="Position_Title"]/text()` |
| BusinessTitle | Business/external title | `//*[local-name()="Business_Title"]/text()` |
| JobProfile | Job profile name | `//*[local-name()="Job_Profile_Name"]/text()` |
| JobFamilyId | Job family identifier (for lookup) | `//*[local-name()='Job_Family_Reference']/*[local-name()='ID' and @type='Job_Family_ID']/text()` |

### Step 2: Job Family Data

| Field | Description |
|-------|-------------|
| JobFamily | Human-readable job family name |

### Final Output Structure

| Field | Description | Example |
|-------|-------------|---------|
| EmployeeName | Full name of the employee | `John Smith` |
| JobTitle | Internal position title | `Senior Software Engineer` |
| BusinessTitle | External-facing title | `Software Engineer III` |
| JobProfile | Job profile classification | `Software Engineering` |
| JobFamily | Job family grouping | `Engineering & Technology` |

## XML Template Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `{Employee_ID}` | Employee's Workday ID | `21514` |
| `{As_Of_Effective_Date}` | Current date (YYYY-MM-DD) | `2026-01-28` |

## Response Group Configuration

The XML template is optimized for performance by only requesting employment information:

```xml
<bsvc:Response_Group>
    <bsvc:Include_Employment_Information>true</bsvc:Include_Employment_Information>
</bsvc:Response_Group>
```

## Example Interactions

### Example 1: Job Title Query
**User**: "What is my job title?"

**Agent**: "Your job title is **Senior Software Engineer**."

---

### Example 2: Job Function Query
**User**: "What job function do I belong to?"

**Agent**: "You belong to the **Engineering & Technology** job family."

---

### Example 3: Full Taxonomy Query
**User**: "Tell me about my role"

**Agent**: "Here's your job information:
- **Job Title**: Senior Software Engineer
- **Business Title**: Software Engineer III
- **Job Profile**: Software Engineering
- **Job Family**: Engineering & Technology"

## Setup Instructions

1. **Import the Topic**: Import `topic.yaml` into your Copilot Studio agent
2. **Add XML Template**: Upload `msdyn_HRWorkdayHCMEmployeeGetJobTaxonomy.xml` to your Workday connector configuration
3. **Configure Connection**: Ensure your Workday connector connection reference is properly set in the topic
4. **Set Global Variables**: Make sure the following are populated from user authentication:
   - `Global.ESS_UserContext_Employee_Id`
   - `Global.ESS_UserContext_Employee_Firstname`
   - `Global.ESS_UserContext_Employee_Lastname`

## Dependencies

- `msdyn_copilotforemployeeselfservicehr.topic.WorkdaySystemGetCommonExecution` - Common API execution topic
- `msdyn_HRWorkdayHCMEmployeeGetJobTaxonomyGeneric` - Secondary scenario for job family lookup
- `Global.ESS_UserContext_Employee_Id` - Current user's employee ID
- `Global.ESS_UserContext_Employee_Firstname` - Current user's first name
- `Global.ESS_UserContext_Employee_Lastname` - Current user's last name

## Model Instructions

The topic includes model instructions to:
- Respond based on the specific piece of data the user is asking for
- Only respond to requests about the user's own job taxonomy
- Reject requests about other employees' data

### Invalid Requests (Rejected)
- "What is my manager's job function?"
- "What is my sister's job title?"
- "What is [EmployeeName]'s role?"

### Valid Requests (Accepted)
- "What is my job title?"
- "What is my external title?"
- "What job family do I belong to?"
- "What is my job profile?"

## Output Type

The topic outputs a `jobFunctionData` record with the following properties:

```yaml
jobFunctionData:
  EmployeeName: String    # e.g., "John Smith"
  JobTitle: String        # e.g., "Senior Software Engineer"
  BusinessTitle: String   # e.g., "Software Engineer III"
  JobProfile: String      # e.g., "Software Engineering"
  JobFamily: String       # e.g., "Engineering & Technology"
```
