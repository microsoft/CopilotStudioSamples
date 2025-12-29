# Workday Update Residential Address

## Overview
This scenario enables employees to update their home/residential address in Workday through the Copilot agent. It retrieves the employee's current home addresses, allows them to select which one to update, and submits the changes via the Workday Change Home Contact Information API.

## Files

| File | Description |
|------|-------------|
| `UpdateResidentialAddress_Topic.yaml` | Copilot Studio topic definition with the complete workflow |
| `msdyn_GetResidentialAddress_Template.xml` | XML template to retrieve current home addresses |
| `msdyn_UpdateResidentialAddress_Template.xml` | XML template to update the home address |

## Prerequisites

### Global Variables Required
- `Global.ESS_UserContext_Employee_Id` - The employee's Workday Employee ID

### Workday API
- **Service**: Human_Resources
- **Version**: v42.0
- **Operations**: 
  - `Get_Workers` - To retrieve current address information
  - `Change_Home_Contact_Information` - To update address

## Workflow

1. **Retrieve Current Addresses**: Calls Get_Workers API with `Include_Personal_Information` to get existing home addresses
2. **Select Address**: If multiple addresses exist, user selects which one to update
3. **Collect New Address**: Displays an Adaptive Card form pre-filled with current values
4. **Confirm Changes**: Shows summary of changes and asks for confirmation
5. **Submit Update**: Calls Change_Home_Contact_Information API to update the address
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

1. **Import the Topic**: Import `UpdateResidentialAddress_Topic.yaml` into your Copilot Studio agent
2. **Add XML Templates**: Upload both XML templates to your Workday connector configuration
3. **Configure Connection**: Ensure your Workday connector connection reference is set in the topic
4. **Set Global Variable**: Ensure `Global.ESS_UserContext_Employee_Id` is populated from user authentication

## Example Interaction

**User**: "I need to update my home address"

**Agent**: Shows current home addresses and asks which one to update

**User**: Selects address

**Agent**: Displays Adaptive Card with form fields pre-filled

**User**: Updates fields and clicks "Update Address"

**Agent**: Shows confirmation with new address details

**User**: Confirms "Yes, update my address"

**Agent**: "✅ Your home address has been successfully updated!"

## Notes

- The `Replace_All="false"` setting ensures only the selected address is updated without affecting other addresses
- Business process parameters include `Auto_Complete=false` and `Run_Now=true` for proper workflow handling
- Address validation is handled by Workday - ensure state/province codes match the country selected
