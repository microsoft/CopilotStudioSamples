# Workday Get Education

## Overview
This scenario enables employees to view their education history from Workday. It retrieves all education records including schools attended, degrees earned, fields of study, and years attended, with human-readable names resolved from reference data.

## Features

- **Complete Education History**: Retrieves all education records for the employee
- **Reference Data Resolution**: Converts country codes, degree IDs, and field of study IDs to human-readable names
- **Multiple Degrees Support**: Handles employees with multiple education entries
- **Access Control**: Verifies the user can only access their own education data

## Files

| File | Description |
|------|-------------|
| `topic.yaml` | Copilot Studio topic definition with trigger phrases and data transformation logic |
| `msdyn_HRWorkdayHCMEmployeeGetEducation.xml` | XML template for Workday Get_Workers API call with qualifications |

## Prerequisites

### Global Variables Required
- `Global.ESS_UserContext_Employee_Id` - The employee's Workday Employee ID
- `Global.ESS_UserContext_Employee_Firstname` - Employee's first name
- `Global.ESS_UserContext_Employee_Lastname` - Employee's last name

### Reference Data Lookup Tables
The topic automatically refreshes these lookup tables if empty:
- `Global.CountryNameLookupTable` - Country names by ISO code
- `Global.DegreeTypeLookupTable` - Degree names by Degree_ID
- `Global.FieldOfStudyLookupTable` - Field of study names by Field_Of_Study_ID

### Workday API
- **Service**: Human_Resources
- **Operation**: Get_Workers
- **Version**: v41.0

## Workflow

```
┌─────────────────────────────────────┐
│   User triggers topic               │
│   (e.g., "Show my education")       │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Access Check                      │
│   (Verify user is requesting        │
│    their own data only)             │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Call Get_Workers API              │
│   (Include_Qualifications = true)   │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Parse Education Data              │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Refresh Reference Data            │
│   (Country, Degree, Field of Study) │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Transform Data with Lookups       │
│   (Resolve IDs to names)            │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Return finalized education data   │
└─────────────────────────────────────┘
```

## Trigger Phrases

- "Show my education details"
- "From which school I completed my BS degree education?"
- "Show my education degrees"
- "What was my field of study during education?"
- "Show my first year attended for BS degree education"
- "Show my last year attended for BS degree education"
- "What is my education?"
- "List my degrees"

## Data Retrieved

| Field | Description | Example |
|-------|-------------|---------|
| EmployeeName | Full name of the employee | `John Smith` |
| Country | Country where education was obtained | `United States` |
| School | Name of the school/university | `University of Washington` |
| Degree | Type of degree earned | `Bachelor of Science` |
| FieldOfStudy | Major or field of study | `Computer Science` |
| FirstYearAttended | Year started | `2010` |
| LastYearAttended | Year completed | `2014` |

## XML Template Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `{Employee_ID}` | Employee's Workday ID | `21514` |
| `{As_Of_Effective_Date}` | Current date (YYYY-MM-DD) | `2026-01-28` |

## Response Group Configuration

The XML template is optimized to only request qualification data:

```xml
<bsvc:Response_Group>
    <bsvc:Include_Qualifications>true</bsvc:Include_Qualifications>
</bsvc:Response_Group>
```

## Response Properties Extracted

| Key | XPath | Description |
|-----|-------|-------------|
| EducationData | `//*[local-name()='Worker']/*[local-name()='Worker_Data']/*[local-name()='Qualification_Data']/*[local-name()='Education']` | All education records |

### Raw Education Data Fields

| Field | Description |
|-------|-------------|
| Education_ID | Unique identifier for the education record |
| School_Name | Name of the institution |
| Country_Reference | Country reference with ID |
| Degree_Reference | Degree type reference with ID |
| Field_Of_Study_Reference | Field of study reference with ID |
| First_Year_Attended | Start year |
| Last_Year_Attended | End year |
| Date_Degree_Received | Date degree was awarded |
| Is_Highest_Level_of_Education | Flag for highest education level |
| Location | Location of the institution |

## Example Interactions

### Example 1: Full Education History
**User**: "Show my education details"

**Agent**: "Here's your education history:

**University of Washington**
- Degree: Bachelor of Science
- Field of Study: Computer Science
- Years: 2010 - 2014
- Country: United States

**Stanford University**
- Degree: Master of Science
- Field of Study: Software Engineering
- Years: 2015 - 2017
- Country: United States"

---

### Example 2: Specific Field Query
**User**: "What was my field of study?"

**Agent**: "Your field of study was **Computer Science** (BS) and **Software Engineering** (MS)."

---

### Example 3: School Query
**User**: "Which schools did I attend?"

**Agent**: "You attended:
- University of Washington (2010-2014)
- Stanford University (2015-2017)"

## Setup Instructions

1. **Import the Topic**: Import `topic.yaml` into your Copilot Studio agent
2. **Add XML Template**: Upload `msdyn_HRWorkdayHCMEmployeeGetEducation.xml` to your Workday connector configuration
3. **Configure Connection**: Ensure your Workday connector connection reference is properly set in the topic
4. **Set Global Variables**: Make sure the following are populated from user authentication:
   - `Global.ESS_UserContext_Employee_Id`
   - `Global.ESS_UserContext_Employee_Firstname`
   - `Global.ESS_UserContext_Employee_Lastname`
5. **Reference Data**: Ensure reference data topics are configured for country, degree, and field of study lookups

## Dependencies

- `msdyn_copilotforemployeeselfservicehr.topic.WorkdaySystemAccessCheck` - Verifies user access permissions
- `msdyn_copilotforemployeeselfservicehr.topic.WorkdaySystemGetCommonExecution` - Common API execution topic
- `msdyn_copilotforemployeeselfservicehr.topic.WorkdaySystemRefreshReferenceData` - Reference data refresh
- `Global.CountryNameLookupTable` - Country reference data
- `Global.DegreeTypeLookupTable` - Degree type reference data
- `Global.FieldOfStudyLookupTable` - Field of study reference data

## Model Instructions

The topic includes model instructions to:
- Respond based on the specific education information the user is asking for
- Only respond to requests about the user's own education
- Reject requests about other employees' data

### Invalid Requests (Rejected)
- "What is my manager's education?"
- "What is my sister's education?"
- "Show [EmployeeName]'s degrees"

### Valid Requests (Accepted)
- "What is my education?"
- "Show my education details"
- "What was my field of study?"
- "Which school did I attend?"

## Output Type

The topic outputs a `FinalizedEducationData` table:

```yaml
FinalizedEducationData:
  - EmployeeName: String     # e.g., "John Smith"
    Country: String          # e.g., "United States"
    School: String           # e.g., "University of Washington"
    Degree: String           # e.g., "Bachelor of Science"
    FieldOfStudy: String     # e.g., "Computer Science"
    FirstYearAttended: String # e.g., "2010"
    LastYearAttended: String  # e.g., "2014"
```

## Customization Guide

### Adding Additional Education Fields

To extract additional fields from Workday's education data, modify the `ParseValue` action in `topic.yaml`. Available fields include:

| Field | Description |
|-------|-------------|
| `Date_Degree_Received` | Exact date degree was awarded |
| `Is_Highest_Level_of_Education` | Flag indicating highest education |
| `Location` | Specific location/campus |
| `Education_ID` | Unique Workday identifier |

### Adding to Final Output

In the `SetVariable` action for `Topic.FinalizedEducationData`, add the new field:

```yaml
{
    ...existing fields...
    DateDegreeReceived: currentRecord.Date_Degree_Received,
    IsHighestLevel: currentRecord.Is_Highest_Level_of_Education = "1"
}
```

### Adding New Reference Data Lookups

To add additional reference data (e.g., School types), add a new `BeginDialog` block:

```yaml
- kind: BeginDialog
  displayName: Refresh school type reference data
  input:
    binding:
      IsTableEmpty: =IsBlank(Global.SchoolTypeLookupTable)
      ReferenceDataKey: School_Type_ID
  dialog: msdyn_copilotforemployeeselfservicehr.topic.WorkdaySystemRefreshReferenceData
```
