# Workday Update Residential Address

## Overview
This scenario enables employees to manage their home/residential address in Workday through the Copilot agent. It retrieves the employee's current home addresses, allows them to select which one to update, add a new address, or modify an existing one, and submits the changes via the Workday Change Home Contact Information API.

## Features

- **View Current Addresses**: Displays the employee's existing home addresses with primary address marked
- **Update Existing Address**: Modify any field of an existing home address
- **Add New Address**: Add a new home address when no addresses exist or when user wants to add another
- **Primary Address Management**: Set or change which address is the primary home address

## Files

| File | Description |
|------|-------------|
| `topic.yaml` | Copilot Studio topic definition with the complete workflow |
| `msdyn_GetResidentialAddress_Template.xml` | XML template to retrieve current home addresses |
| `msdyn_UpdateResidentialAddress_Template.xml` | XML template to update an existing home address |
| `msdyn_AddResidentialAddress_Template.xml` | XML template to add a new home address |

## Prerequisites

### Global Variables Required
- `Global.ESS_UserContext_Employee_Id` - The employee's Workday Employee ID

### Workday API
- **Service**: Human_Resources
- **Version**: v42.0
- **Operations**: 
  - `Get_Workers` - To retrieve current address information
  - `Change_Home_Contact_Information` - To add or update address

## Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                    User Triggers Topic                       │
│        "Update my home address" / "Change my address"        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│          Fetch Current Home Addresses                        │
│              (Get_Workers API)                               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────┴───────────────┐
              │    Has Existing Addresses?     │
              └───────────────┬───────────────┘
                    │                   │
                   Yes                  No
                    │                   │
                    ▼                   ▼
    ┌───────────────────────┐   ┌─────────────────┐
    │  Show Selection Card   │   │  Show Add Form  │
    │  • Existing addresses  │   │  (empty form)   │
    │  ➕ Add New Address    │   │                 │
    └───────────────────────┘   └─────────────────┘
              │                         │
              ▼                         │
    ┌───────────────────────┐          │
    │   User Selects        │          │
    │   Address or Add New  │          │
    └───────────────────────┘          │
              │                         │
      ┌───────┴───────┐                │
      │               │                │
      ▼               ▼                ▼
┌───────────┐   ┌───────────────────────────┐
│  Update   │   │  Add New Address Form     │
│  Form     │   │                           │
│(pre-fill) │   │                           │
└───────────┘   └───────────────────────────┘
      │                   │
      └─────────┬─────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────┐
│            Show Confirmation Card                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│            Submit to Workday                                 │
│    (Change_Home_Contact_Information API)                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│            Display Success/Error Message                     │
└─────────────────────────────────────────────────────────────┘
```

## Workflow Steps

1. **Retrieve Current Addresses**: Calls Get_Workers API with `Include_Personal_Information` to get existing home addresses
2. **Select Address**: If addresses exist, user selects which one to update or chooses to add new
3. **Collect Address Data**: Displays an Adaptive Card form (pre-filled for updates, empty for new)
4. **Confirm Changes**: Shows summary of changes and asks for confirmation
5. **Submit**: Calls Change_Home_Contact_Information API to add or update the address
6. **Display Result**: Shows success or error message

## Address Fields

| Field | Required | Description |
|-------|----------|-------------|
| Address Line 1 | Yes | Street address |
| Address Line 2 | No | Apartment, Suite, Unit (optional) |
| City | Yes | Municipality |
| State/Province | Yes | State or Province code (e.g., USA-CA) |
| Country | Yes | ISO 3166-1 Alpha-3 code (e.g., USA, CAN) |
| Postal Code | Yes | ZIP or Postal code |
| Primary Address | No | Toggle to set as primary home address |

## Supported Countries

The Adaptive Card includes dropdown options for:
- United States (USA)
- Canada (CAN)
- United Kingdom (GBR)
- Australia (AUS)
- Germany (DEU)
- France (FRA)
- India (IND)
- Japan (JPN)
- Mexico (MEX)
- Brazil (BRA)

## Supported States/Provinces

Pre-configured for:
- All 50 US States + DC
- Canadian provinces (Ontario, Quebec, British Columbia, Alberta)

> **Note**: To add more states/provinces, update the `stateProvince` choices in the Adaptive Card within the topic YAML.

## Trigger Phrases

- "Update my home address"
- "I want to update my residential address"
- "Change my address"
- "Update my street address"
- "I moved to a new address"
- "Add a new home address"

## XML Template Parameters

### Get Address Template (`msdyn_HRWorkdayHCMEmployeeGetResidentialAddress`)
| Parameter | Description |
|-----------|-------------|
| `{Employee_ID}` | Employee's Workday ID |
| `{As_Of_Effective_Date}` | Current date (yyyy-MM-dd format) |

### Update Address Template (`msdyn_HRWorkdayHCMEmployeeUpdateResidentialAddress`)
| Parameter | Description |
|-----------|-------------|
| `{Employee_ID}` | Employee's Workday ID |
| `{Event_Effective_Date}` | Effective date of the change |
| `{Address_ID}` | ID of the address being updated |
| `{Country_Code}` | ISO 3166-1 Alpha-3 country code |
| `{State_Province_Code}` | Country Region ID (e.g., USA-CA) |
| `{Address_Line_1}` | Street address line 1 |
| `{Address_Line_2}` | Street address line 2 (optional) |
| `{City}` | Municipality name |
| `{Postal_Code}` | ZIP/Postal code |
| `{Is_Primary}` | true/false for primary address |

### Add Address Template (`msdyn_HRWorkdayHCMEmployeeAddResidentialAddress`)
| Parameter | Description |
|-----------|-------------|
| `{Employee_ID}` | Employee's Workday ID |
| `{Event_Effective_Date}` | Effective date of the change |
| `{Country_Code}` | ISO 3166-1 Alpha-3 country code |
| `{State_Province_Code}` | Country Region ID (e.g., USA-CA) |
| `{Address_Line_1}` | Street address line 1 |
| `{Address_Line_2}` | Street address line 2 (optional) |
| `{City}` | Municipality name |
| `{Postal_Code}` | ZIP/Postal code |
| `{Is_Primary}` | true/false for primary address |

## Response Extraction

### Get Address Response
| Field | XPath |
|-------|-------|
| FormattedAddress | `//*[local-name()='Address_Data']/@*[local-name()='Formatted_Address']` |
| AddressID | `//*[local-name()='Address_ID']/text()` |
| CountryCode | `//*[local-name()='Country_Reference']/*[local-name()='ID' and @type='ISO_3166-1_Alpha-3_Code']` |
| StateProvinceCode | `//*[local-name()='Country_Region_Reference']/*[local-name()='ID' and @type='Country_Region_ID']` |
| City | `//*[local-name()='Municipality']/text()` |
| PostalCode | `//*[local-name()='Postal_Code']/text()` |

## Setup Instructions

1. **Import the Topic**: Import `topic.yaml` into your Copilot Studio agent
2. **Add XML Templates**: Upload all three XML templates to your Workday connector configuration
3. **Configure Connection**: Ensure your Workday connector connection reference is set in the topic
4. **Set Global Variable**: Ensure `Global.ESS_UserContext_Employee_Id` is populated from user authentication

## Example Interactions

### Updating an Existing Address

**User**: "I need to update my home address"

**Agent**: Shows current home addresses and asks which one to update

**User**: Selects address

**Agent**: Displays Adaptive Card with form fields pre-filled

**User**: Updates fields and clicks "Update Address"

**Agent**: Shows confirmation with new address details

**User**: Confirms "Yes, update my address"

**Agent**: "✅ Your home address has been successfully updated!"

### Adding a New Address

**User**: "Add a new home address"

**Agent**: "I don't see any existing home addresses on file. Let me help you add one."

**Agent**: Displays empty Adaptive Card form

**User**: Fills in address details and clicks "Add Address"

**Agent**: Shows confirmation with new address details

**User**: Confirms

**Agent**: "✅ Your new home address has been successfully added!"

## Notes

- The `Replace_All="false"` setting ensures only the selected address is updated without affecting other addresses
- Business process parameters include `Auto_Complete=false` and `Run_Now=true` for proper workflow handling
- Address validation is handled by Workday - ensure state/province codes match the country selected
- When adding a new address, no Address_ID is required as Workday generates one automatically

## Dependencies

- `msdyn_copilotforemployeeselfservicehr.topic.WorkdaySystemGetCommonExecution` - For API execution
- `Global.ESS_UserContext_Employee_Id` - Current user's employee ID

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | December 2025 | Initial release with Update functionality |
| 1.1 | February 2026 | Added Add New Address functionality |
