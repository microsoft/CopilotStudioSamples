# Workday Get User Profile

This scenario enables employees to retrieve their profile information from Workday through a conversational interface. It provides comprehensive employee data including personal details, employment information, contact details, and tenure calculations.

## Features

- **Personal Information**: Name, Date of Birth, Gender
- **Employment Details**: Employee ID, Business Title, Organization/Department, Manager, Location
- **Contact Information**: Work Email, Work Phone, Home Email, Home Phone, Home Address
- **Employment Status**: Active/Inactive status, Hire Date
- **Tenure Calculation**: Continuous Service Date and calculated Length of Service (years, months, days)

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

## Flow Overview

```
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
│           Return finalizedData Record                        │
│       (All fields available for AI to respond)              │
└─────────────────────────────────────────────────────────────┘
```

## Length of Service Calculation

The topic automatically calculates the employee's length of service from their Continuous Service Date:

```
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

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | December 2025 | Initial release with comprehensive profile retrieval |
