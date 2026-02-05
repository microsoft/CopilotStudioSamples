# Workday Manage Emergency Contact

This scenario enables employees to manage their emergency contacts in Workday through a conversational interface. It supports adding new emergency contacts, updating existing ones, and deleting contacts.

## Features

- **View Existing Contacts**: Displays a list of the employee's current emergency contacts with primary contact marked with ⭐
- **Add New Contact**: Allows employees to add a new emergency contact
- **Update Existing Contact**: Allows employees to update details of an existing emergency contact
- **Delete Contact**: Allows employees to remove an emergency contact from their profile
- **Primary Contact Management**: Set or change the primary emergency contact
- **Priority Assignment**: Assign priority levels (1-10) to contacts

## Trigger Phrases

Users can activate this topic with phrases like:
- "Manage my emergency contacts"
- "Update my emergency contact"
- "Add emergency contact"
- "Change my emergency contact information"
- "Edit my emergency contact details"
- "Who is my emergency contact?"
- "Show my emergency contacts"
- "Delete my emergency contact"
- "Remove an emergency contact"

## Files

| File | Description |
|------|-------------|
| `topic.yaml` | Main Copilot Studio topic definition with the conversational flow |
| `msdyn_HRWorkdayHCMEmployeeGetEmergencyContactInfo.xml` | XML template to fetch existing emergency contacts using Get_Workers API |
| `msdyn_HRWorkdayHCMEmployeeAddEmergencyContact.xml` | XML template to add a new emergency contact |
| `msdyn_HRWorkdayHCMEmployeeUpdateEmergencyContact.xml` | XML template to update an existing emergency contact |
| `msdyn_HRWorkdayDeleteEmergencyContact.xml` | XML template to delete an existing emergency contact |

## Workday APIs Used

| API | Service | Version | Purpose |
|-----|---------|---------|---------|
| `Get_Workers` | Human_Resources | v45.0 | Retrieve employee's existing emergency contacts |
| `Change_Emergency_Contacts` | Human_Resources | v45.0 | Add, update, or delete emergency contact information |

## Data Collected

The topic collects the following information for each emergency contact:

### Required Fields
- **First Name** - Contact's first name
- **Last Name** - Contact's last name
- **Relationship** - Relationship to the employee (e.g., Spouse, Parent, Sibling)
- **Phone Country Code** - International dialing code
- **Phone Number** - Contact phone number
- **Phone Type** - Mobile, Home, or Work
- **Address Line 1** - Street address
- **City** - City name
- **State/Province** - State or province (supports USA, Canada, UK, India, Australia, Germany, France)
- **Postal Code** - ZIP or postal code
- **Country** - Country code

### Optional Settings
- **Primary Contact** - Toggle to set as primary emergency contact
- **Priority** - Priority level (2-10, or 1 if primary)

## Flow Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    User Triggers Topic                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│           Fetch Reference Data (Country Codes,              │
│                  Relationship Types)                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│          Fetch Existing Emergency Contacts                   │
│              (Get_Workers API)                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────┴───────────────┐
              │    Has Existing Contacts?      │
              └───────────────┬───────────────┘
                    │                   │
                   Yes                  No
                    │                   │
                    ▼                   ▼
    ┌───────────────────────┐   ┌─────────────────┐
    │  Show Selection Card   │   │  Go to Add Mode │
    │  ⭐ Primary Contact    │   │                 │
    │  • Other Contacts      │   │                 │
    │  ➕ Add New Contact    │   │                 │
    │  🗑️ Delete Contact     │   │                 │
    └───────────────────────┘   └─────────────────┘
              │                         │
              ▼                         │
    ┌───────────────────────┐          │
    │   User Selects        │          │
    │   Action              │          │
    └───────────────────────┘          │
              │                         │
      ┌───────┼───────┐                │
      │       │       │                │
      ▼       ▼       ▼                ▼
┌─────────┐ ┌─────────┐ ┌─────────────────────┐
│  Add    │ │  Update │ │  Delete             │
│  Form   │ │  Form   │ │  Confirmation       │
└─────────┘ └─────────┘ └─────────────────────┘
      │       │                │
      └───────┴────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│            Submit to Workday                                 │
│    (Change_Emergency_Contacts API)                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│            Display Success/Error Message                     │
└─────────────────────────────────────────────────────────────┘
```

## Dependencies

This topic requires the following system topics/dialogs:
- `msdyn_copilotforemployeeselfservicehr.topic.GetReferenceData` - For fetching country codes and relationship types
- `msdyn_copilotforemployeeselfservicehr.topic.WorkdaySystemGetCommonExecution` - For executing Workday API calls

## Global Variables Used

| Variable | Description |
|----------|-------------|
| `Global.ESS_UserContext_Employee_Id` | The logged-in employee's Workday Employee ID |
| `Global.CountryCodeLookupTable` | Cached country phone codes |
| `Global.RelatedPersonRelationshipLookupTable` | Cached relationship types |

## Important Notes

1. **Replace_All Setting**: The XML templates use `<bsvc:Replace_All>false</bsvc:Replace_All>` to ensure that adding or updating a contact does not delete other existing contacts.

2. **Primary Contact Priority**: When a contact is set as primary, their priority is automatically set to 1.

3. **Contact Selection**: Existing contacts are sorted with the primary contact at the top (marked with ⭐), followed by other contacts sorted by priority.

## Error Handling

The topic includes error handling for:
- Failed API calls to Workday
- User cancellation at any step
- Validation errors on required fields

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | December 2025 | Initial release with Add/Update functionality |
| 1.1 | February 2026 | Added Delete functionality for removing emergency contacts |
