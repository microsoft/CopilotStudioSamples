# Workday Get Government IDs

## Overview
This scenario enables employees to view their government identification documents from Workday. It retrieves all government IDs on file including ID type, country of issue, issue date, and expiration date, with human-readable names resolved from reference data.

## Features

- **Multiple ID Support**: Retrieves all government IDs associated with the employee
- **Reference Data Resolution**: Converts country codes and ID type codes to human-readable names
- **Expiration Tracking**: Shows issue and expiration dates for each ID
- **Access Control**: Verifies the user can only access their own government ID data

## Files

| File | Description |
|------|-------------|
| `topic.yaml` | Copilot Studio topic definition with trigger phrases and data transformation logic |
| `msdyn_HRWorkdayHCMEmployeeGetGovernmentIds.xml` | XML template for Workday Get_Workers API call with personal information |

## Prerequisites

### Global Variables Required
- `Global.ESS_UserContext_Employee_Id` - The employee's Workday Employee ID
- `Global.ESS_UserContext_Employee_Firstname` - Employee's first name
- `Global.ESS_UserContext_Employee_Lastname` - Employee's last name

### Reference Data Lookup Tables
The topic automatically refreshes these lookup tables if empty:
- `Global.CountryNameLookupTable` - Country names by ISO code
- `Global.GovernmentIdTypeLookupTable` - Government ID type names

### Workday API
- **Service**: Human_Resources
- **Operation**: Get_Workers
- **Version**: v42.0

## Workflow

```
┌─────────────────────────────────────┐
│   User triggers topic               │
│   (e.g., "What are my government    │
│   IDs?")                            │
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
│   (Include_Personal_Information)    │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Parse Government ID Data          │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Refresh Reference Data            │
│   (Country, Government ID Type)     │
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
│   Return finalized ID data          │
└─────────────────────────────────────┘
```

## Trigger Phrases

- "What are my government IDs?"
- "Which government IDs are available on my profile?"
- "Show my government IDs"
- "What IDs do I have on file?"
- "Show my identification documents"

## Data Retrieved

| Field | Description | Example |
|-------|-------------|---------|
| EmployeeName | Full name of the employee | `John Smith` |
| IDType | Type of government ID | `Passport`, `Social Security Number`, `Driver's License` |
| ID | The ID number (may be masked) | `***-**-1234` |
| CountryName | Country that issued the ID | `United States` |
| IssuedDate | Date the ID was issued | `2020-05-15` |
| ExpirationDate | Date the ID expires | `2030-05-14` |

## XML Template Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `{Employee_ID}` | Employee's Workday ID | `21514` |
| `{As_Of_Effective_Date}` | Current date (YYYY-MM-DD) | `2026-01-28` |

## Response Group Configuration

The XML template requests personal information which includes government IDs:

```xml
<bsvc:Response_Group>
    <bsvc:Include_Personal_Information>true</bsvc:Include_Personal_Information>
</bsvc:Response_Group>
```

## Response Properties Extracted

| Key | XPath | Description |
|-----|-------|-------------|
| GovernmentId | `//*[local-name()='Government_ID']/*[local-name()='Government_ID_Data']` | All government ID records |

### Raw Government ID Data Fields

| Field | Description |
|-------|-------------|
| ID | The government ID value |
| ID_Type_Reference | Reference to the type of ID |
| Country_Reference | Reference to the issuing country |
| Issued_Date | Date the ID was issued |
| Expiration_Date | Date the ID expires |

## Example Interactions

### Example 1: All Government IDs
**User**: "What are my government IDs?"

**Agent**: "Here are your government IDs on file:

**Passport**
- Country: United States
- Issued: 2020-05-15
- Expires: 2030-05-14

**Driver's License**
- Country: United States
- Issued: 2022-03-10
- Expires: 2028-03-10

**Social Security Number**
- Country: United States"

---

### Example 2: Specific Query
**User**: "Do I have a passport on file?"

**Agent**: "Yes, you have a **United States Passport** on file. It was issued on 2020-05-15 and expires on 2030-05-14."

---

### Example 3: Expiration Check
**User**: "When does my driver's license expire?"

**Agent**: "Your driver's license expires on **2028-03-10**."

## Setup Instructions

1. **Import the Topic**: Import `topic.yaml` into your Copilot Studio agent
2. **Add XML Template**: Upload `msdyn_HRWorkdayHCMEmployeeGetGovernmentIds.xml` to your Workday connector configuration
3. **Configure Connection**: Ensure your Workday connector connection reference is properly set in the topic
4. **Set Global Variables**: Make sure the following are populated from user authentication:
   - `Global.ESS_UserContext_Employee_Id`
   - `Global.ESS_UserContext_Employee_Firstname`
   - `Global.ESS_UserContext_Employee_Lastname`
5. **Reference Data**: Ensure reference data topics are configured for country and government ID type lookups

## Dependencies

- `msdyn_copilotforemployeeselfservicehr.topic.WorkdaySystemAccessCheck` - Verifies user access permissions
- `msdyn_copilotforemployeeselfservicehr.topic.WorkdaySystemGetCommonExecution` - Common API execution topic
- `msdyn_copilotforemployeeselfservicehr.topic.WorkdaySystemRefreshReferenceData` - Reference data refresh
- `Global.CountryNameLookupTable` - Country reference data
- `Global.GovernmentIdTypeLookupTable` - Government ID type reference data

## Model Instructions

The topic includes model instructions to:
- Respond based on the specific government ID information the user is asking for
- Only respond to requests about the user's own government IDs
- Reject requests about other employees' data

### Invalid Requests (Rejected)
- "What are my manager's government IDs?"
- "What are my sister's government IDs?"
- "Show [EmployeeName]'s government IDs"

### Valid Requests (Accepted)
- "What are my government IDs?"
- "Which government IDs are available on my profile?"
- "Show my government IDs"

## Output Type

The topic outputs a `finalizedResponseTableData` table:

```yaml
finalizedResponseTableData:
  - EmployeeName: String     # e.g., "John Smith"
    IDType: String           # e.g., "Passport"
    ID: String               # e.g., "***-**-1234"
    CountryName: String      # e.g., "United States"
    IssuedDate: String       # e.g., "2020-05-15"
    ExpirationDate: String   # e.g., "2030-05-14"
```
