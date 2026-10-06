---
nav_exclude: true
search_exclude: false
---
# Workday Get User Profile

This scenario enables employees to retrieve their profile information from Workday through a conversational interface. It provides comprehensive employee data including personal details, employment information, contact details, and tenure calculations.

Explicit full-profile requests use a deterministic response so the layout is consistent across supported models. Requests for individual fields and tenure information continue to return only the information the employee requested.

## Features

- **Personal Information**: Name, Date of Birth, Gender
- **Employment Details**: Employee ID, Business Title, Organization/Department, Manager, Location
- **Contact Information**: Work Email, Work Phone, Home Email, Home Phone, Home Address
- **Employment Status**: Active/Inactive status, Hire Date
- **Tenure Calculation**: Continuous Service Date and calculated Length of Service (years, months, days)
- **Deterministic Full Profile**: Complete profile requests are grouped under `Personal information`, `Hiring details`, and `Role and work`

## Trigger Phrases

Users can activate this topic with phrases like:
- "What is my profile?"
- "Show my profile"
- "What is my employee ID?"
- "What is my job title?"
- "What is my work email?"
- "Who is my manager?"
- "What department am I in?"
- "What is my tenure?"
- "How long have I been with the company?"
- "What is my hire date?"
- "Am I an active employee?"

## Files

| File | Description |
|------|-------------|
| `topic.yaml` | Main Copilot Studio topic definition |
| `msdyn_HRWorkdayHCMEmployeeGetUserProfile.xml` | XML template with XPath extractions for profile data |

## Workday APIs Used

| API | Service | Version | Purpose |
|-----|---------|---------|---------|
| `Get_Workers` | Human_Resources | v45.0 | Retrieve comprehensive employee profile data |

## Data Retrieved

The topic extracts the following fields from Workday:

| Field | XPath Source | Description |
|-------|--------------|-------------|
| `EmployeeID` | Worker_Data/Worker_ID | Employee's Workday ID |
| `Name` | Worker_Descriptor | Employee's full name |
| `DOB` | Personal_Information_Data/Birth_Date | Date of birth |
| `Gender` | Gender_Reference/@Descriptor | Gender |
| `BusinessTitle` | Position_Data/Business_Title | Job title |
| `Organization` | Organization_Reference (SUPERVISORY_ORGANIZATION) | Department/Org |
| `Manager` | Manager_Reference/@Descriptor | Direct manager's name |
| `Location` | Location_Reference/@Descriptor | Work location |
| `HireDate` | Worker_Status_Data/Hire_Date | Original hire date |
| `WorkEmail` | Email_Address (WORK usage type) | Work email address |
| `HomeAddress` | Address_Data (HOME usage type) | Formatted home address |
| `HomeEmail` | Email_Address (HOME usage type, primary) | Personal email |
| `HomePhone` | Phone_Data (HOME usage type, primary) | Home phone number |
| `WorkPhone` | Phone_Data (WORK usage type, primary) | Work phone number |
| `Status` | Worker_Status_Data/Active | Employment status (Active/Inactive) |
| `ContinuousServiceDate` | Worker_Status_Data/Continuous_Service_Date | Service start date |
| `LengthOfService` | *Calculated* | Years, months, days of service |

## Response Modes

The topic classifies each request into a `ResponseScope`:

| Scope | Behavior |
|-------|----------|
| `full-profile` | Sends the complete employee profile directly with the required grouped layout |
| `tenure` | Returns only position and length-of-service information |
| `field` | Returns only the profile fields explicitly requested; this is the default when scope is uncertain |

The `field` default prevents an ambiguous or unrecognized request from returning the employee's complete profile.

If the current conversation does not yet have a Workday employee ID, the topic initializes Workday user context before retrieving the profile. This supports both direct Custom Engine Agent conversations and invocation through a Declarative Agent.

### Full-profile Layout

The deterministic full-profile response maps fields as follows:

| Section | Fields |
|---------|--------|
| `Personal information` | Name, date of birth, gender, home address, home email, home phone |
| `Hiring details` | Employee ID, hire date, continuous service date, length of service, employment status |
| `Role and work` | Business title, organization, manager, location, work email, work phone |

Fields and sections without a value are omitted.

## Validation

After importing the topic, validate these prompts in the Copilot Studio Test pane:

| Prompt | Expected behavior |
|--------|-------------------|
| `Show me my employee profile summary.` | Returns one response with the heading `Your employee profile` and the sections `Personal information`, `Hiring details`, and `Role and work` |
| `What is my work email?` | Returns the work email without the complete profile |
| `How long have I been with the company?` | Returns the `Time in your position` response without the complete profile |

Repeat the full-profile prompt with an account that has blank optional contact fields and confirm that empty bullets and empty sections are omitted. Simulate a failed Workday request and confirm that the topic returns the friendly retrieval error instead of an empty profile.

## Flow Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                    User Triggers Topic                       │
│         (e.g., "What is my profile?")                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Call Get_Workers API                            │
│         (with Employee_ID and As_Of_Date)                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│           Parse Response via XPath                           │
│      (Extract all profile fields)                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│         Calculate Length of Service                          │
│    (Years, Months, Days from Continuous Service Date)       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│        Select response using ResponseScope                   │
│  (direct full profile or selective AI-composed response)    │
└─────────────────────────────────────────────────────────────┘
```

## Length of Service Calculation

The topic automatically calculates the employee's length of service from their Continuous Service Date:

```text
Years:  RoundDown(DateDiff(ServiceDate, Today, Months) / 12, 0)
Months: Mod(DateDiff(ServiceDate, Today, Months), 12)
Days:   DateDiff(AdjustedDate, Today, Days)
```

Output format: "X year(s) Y month(s) Z day(s)"

## Dependencies

This topic requires the following system topics/dialogs:
- `msdyn_copilotforemployeeselfservicehr.topic.WorkdaySystemGetCommonExecution` - For executing Workday API calls

## Global Variables Used

| Variable | Description |
|----------|-------------|
| `Global.ESS_UserContext_Employee_Id` | The logged-in employee's Workday Employee ID |

## Output

The topic outputs a `finalizedData` record containing all profile fields that can be used by the AI orchestrator to formulate responses based on what the user specifically asked for.

```yaml
outputType:
  properties:
    finalizedData:
      type: Record
      properties:
        EmployeeID: String
        Name: String
        DOB: String
        Gender: String
        BusinessTitle: String
        Organization: String
        Manager: String
        Location: String
        HireDate: String
        WorkEmail: String
        HomeAddress: String
        HomeEmail: String
        HomePhone: String
        WorkPhone: String
        Status: String
        ContinuousServiceDate: String
        LengthOfService: String
```

## Important Notes

1. **Privacy**: This topic only returns data for the requesting user. Questions about other employees (managers, colleagues) are explicitly rejected per the model description.

2. **Tenure Information**: Length of Service is only included in the AI's response when the user specifically asks about tenure, service length, or how long they've been with the company.

3. **Status Conversion**: The raw `Active` field from Workday (1 or 0) is converted to human-readable "Active" or "Inactive".

4. **Response Optimization**: The Get_Workers request is optimized to exclude unnecessary data (benefits, qualifications, photos, etc.) to improve performance.

5. **Full-profile Formatting**: Complete profile requests are rendered directly by the topic. This prevents the orchestration model from flattening or restyling the required sections.

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.1 | October 2026 | Added deterministic grouped rendering for full-profile requests and fail-closed response-scope detection |
| 1.0 | December 2025 | Initial release with comprehensive profile retrieval |
