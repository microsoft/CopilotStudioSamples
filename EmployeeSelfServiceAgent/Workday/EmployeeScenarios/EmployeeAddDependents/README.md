# Add Dependents

This scenario allows employees to add new dependents to their Workday profile for benefits enrollment purposes.

## Overview

The `AddDependents` topic allows employees to:
1. **View** their existing dependents
2. **Add** a new dependent (spouse, child, domestic partner, etc.)

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
| `AddDependents_Topic.yaml` | Main topic definition with full flow |
| `msdyn_GetDependents_Template.xml` | XML template for fetching existing dependents |
| `msdyn_AddDependent_Template.xml` | XML template for adding a new dependent |


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

## Dependencies

- `msdyn_copilotforemployeeselfservicehr.topic.GetReferenceData` - For fetching relationship types
- `msdyn_copilotforemployeeselfservicehr.topic.WorkdaySystemGetCommonExecution` - For API execution
- `Global.RelatedPersonRelationshipLookupTable` - Relationship types lookup
- `Global.ESS_UserContext_Employee_Id` - Current user's employee ID