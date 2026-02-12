# Add Dependents

This scenario allows employees to add new dependents to their Workday profile for benefits enrollment purposes.

## Overview

The `EmployeeAddDependents` topic allows employees to:
1. **View** their existing dependents
2. **Add** a new dependent (spouse, child, domestic partner, etc.)

## Features

- **View Existing Dependents**: Displays a list of the employee's current dependents with their relationship and date of birth
- **Add New Dependent**: Allows employees to add a new dependent with full details
- **Relationship Types**: Dynamic dropdown populated from Workday reference data
- **Confirmation Flow**: Shows summary of dependent details before submission

## Flow

```
┌─────────────────────────────────────┐
│   User triggers topic               │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Fetch reference data              │
│   (Relationship Types)              │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Fetch existing dependents         │
│   (msdyn_HRWorkdayHCMEmployee       │
│    GetDependents)                   │
└──────────────┬──────────────────────┘
               │
               ▼
        ┌──────┴──────┐
        │ Dependents  │
        │   exist?    │
        └──────┬──────┘
               │
       ┌───────┴───────┐
       │               │
       ▼               ▼
┌──────────────┐ ┌──────────────┐
│ Show list of │ │ "No deps on  │
│ existing     │ │ file yet"    │
│ dependents   │ │              │
└──────┬───────┘ └──────┬───────┘
       │                │
       └───────┬────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Show Add Dependent Form           │
│   (Adaptive Card)                   │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Show Confirmation Card            │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Submit to Workday                 │
│   (msdyn_HRWorkdayHCMEmployee       │
│    AddDependent)                    │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Show success/error message        │
└─────────────────────────────────────┘
```

## Files

| File | Purpose |
|------|---------|
| `topic.yaml` | Main topic definition with full flow |
| `msdyn_HRWorkdayHCMEmployeeGetDependents.xml` | XML template for fetching existing dependents |
| `msdyn_HRWorkdayHCMEmployeeAddDependent.xml` | XML template for adding a new dependent |


## API Scenarios Used

| Scenario | API | Purpose |
|----------|-----|---------|
| `msdyn_HRWorkdayHCMEmployeeGetDependents` | Human_Resources v45.0 | Fetch existing dependents |
| `msdyn_HRWorkdayHCMEmployeeAddDependent` | Benefits_Administration v45.1 | Add new dependent |

## XPath Filtering

The Get Dependents template uses XPath predicates to filter only actual dependents (excluding emergency contacts):

```xpath
//*[local-name()='Related_Person_Data']/*[local-name()='Related_Person'][*[local-name()='Dependent']]
```

This ensures that only `Related_Person` nodes containing a `Dependent` child element are returned.

## Form Fields

| Field | Type | Required | Source |
|-------|------|----------|--------|
| First Name | Text Input | Yes | User entry |
| Last Name | Text Input | Yes | User entry |
| Date of Birth | Date Input | Yes | User entry |
| Gender | Dropdown | Yes | Hardcoded (Male, Female, Not_Declared) |
| Relationship | Dropdown | Yes | Dynamic from `Global.RelatedPersonRelationshipLookupTable` |
| Country | Dropdown | Yes | Hardcoded (USA, CAN, GBR, AUS, DEU, FRA, IND) |

## Parameters

### Add Dependent Template Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `{Employee_ID}` | Employee's Workday ID | `21514` |
| `{First_Name}` | Dependent's first name | `John` |
| `{Last_Name}` | Dependent's last name | `Smith` |
| `{Date_Of_Birth}` | Date of birth (YYYY-MM-DD) | `2015-06-15` |
| `{Gender}` | Gender code | `Male` / `Female` / `Not_Declared` |
| `{Relationship_Type}` | Relationship type ID | `Biological_Child` |
| `{Country_Code}` | Country ISO code | `USA` |

### Get Dependents Template Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `{Employee_ID}` | Employee's Workday ID | `21514` |
| `{As_Of_Effective_Date}` | Effective date (YYYY-MM-DD) | `2025-12-30` |

## Response Data Extracted

### Get Dependents Response

| Key | XPath | Description |
|-----|-------|-------------|
| `DependentID` | `.//ID[@type='Dependent_ID']` | Unique dependent identifier |
| `DependentWID` | `.//ID[@type='WID']` (Dependent_Reference) | Workday Internal ID |
| `PersonWID` | `.//ID[@type='WID']` (Person_Reference) | Person reference WID |
| `FullName` | `.//Name_Detail_Data/@Formatted_Name` | Full formatted name |
| `FirstName` | `.//First_Name` | First name |
| `LastName` | `.//Last_Name` | Last name |
| `DateOfBirth` | `.//Dependent_Data/Date_of_Birth` | Date of birth |
| `Gender` | `.//Dependent_Data/Gender_Reference/@Descriptor` | Gender |
| `RelationshipTypeID` | `.//Related_Person_Relationship_ID` | Relationship type ID |
| `IsFullTimeStudent` | `.//Full_Time_Student` | Full-time student flag |
| `IsDisabled` | `.//Disabled` | Disabled flag |

### Add Dependent Response

| Key | XPath | Description |
|-----|-------|-------------|
| `DependentWID` | `.//Dependent_Reference/ID[@type='WID']` | Created dependent WID |
| `DependentID` | `.//Dependent_Reference/ID[@type='Dependent_ID']` | Created dependent ID |

## Example Triggers

- "Add a dependent"
- "I want to add my child as a dependent"
- "Add my spouse to my benefits"
- "Register a new dependent"
- "I need to add a family member"
- "Show my dependents"
- "Who are my dependents?"

## Dependencies

- `msdyn_copilotforemployeeselfservicehr.topic.GetReferenceData` - For fetching relationship types
- `msdyn_copilotforemployeeselfservicehr.topic.WorkdaySystemGetCommonExecution` - For API execution
- `Global.RelatedPersonRelationshipLookupTable` - Relationship types lookup
- `Global.ESS_UserContext_Employee_Id` - Current user's employee ID

## Trigger Phrases

- "Add a dependent"
- "I want to add my child as a dependent"
- "Add my spouse to my benefits"
- "Register a new dependent"
- "I need to add a family member"
- "Show my dependents"
- "Who are my dependents?"

## Example Interaction

**User**: "I want to add my child as a dependent"

**Agent**: Shows existing dependents (if any) and displays the Add Dependent form

**User**: Fills in child's details (name, DOB, gender, relationship)

**Agent**: Shows confirmation card with summary of dependent details

**User**: Confirms "Yes, add this dependent"

**Agent**: "✅ Your dependent has been successfully added!"

## Setup Instructions

1. **Import the Topic**: Import `topic.yaml` into your Copilot Studio agent
2. **Add XML Templates**: Upload both XML templates to your Workday connector configuration
3. **Configure Connection**: Ensure your Workday connector connection reference is set in the topic
4. **Set Global Variable**: Ensure `Global.ESS_UserContext_Employee_Id` is populated from user authentication

## Notes

- Relationship types are dynamically loaded from Workday reference data
- The topic validates that all required fields are completed before submission
- Gender options are hardcoded as Male, Female, and Not_Declared to match Workday values
- Country codes use ISO 3166-1 Alpha-3 format (e.g., USA, CAN, GBR)

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Failed to fetch dependents | Error message displayed, dialog ends |
| Failed to add dependent | Error message with option to retry |
| User cancels | Dialog ends gracefully |
| Missing required fields | Form validation prevents submission |

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | December 2025 | Initial release with Add Dependent functionality |