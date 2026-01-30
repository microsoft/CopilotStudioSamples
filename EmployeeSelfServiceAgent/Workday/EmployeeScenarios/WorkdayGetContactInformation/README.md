# Workday Get Contact Information

## Overview
This scenario enables employees to view their complete contact information from Workday, including both work and personal (home) contact details. It retrieves phone numbers, email addresses, and physical addresses, with primary contact indicators.

## Features

- **Work Contact Information**: Work phone numbers, work emails, and work address
- **Home/Personal Contact Information**: Personal phone numbers, personal emails, and home address
- **Primary Indicators**: Identifies which phone/email is marked as primary
- **Access Control**: Verifies the user can only access their own contact information
- **Comprehensive Data**: Combines three API calls for complete contact profile

## Files

| File | Description |
|------|-------------|
| `topic.yaml` | Copilot Studio topic definition with trigger phrases and data transformation logic |
| `msdyn_HRWorkdayHCMEmployeeGetHomeContactInformation.xml` | XML template for fetching home/personal contact information |

> **Note**: This scenario also uses two additional shared templates from the common ESS configuration:
> - `msdyn_HRWorkdayHCMEmployeeGetWorkContactInformation` - For work phone/email data
> - `msdyn_HRWorkdayHCMEmployeeGetWorkAddress` - For work address data

## Prerequisites

### Global Variables Required
- `Global.ESS_UserContext_Employee_Id` - The employee's Workday Employee ID
- `Global.ESS_UserContext_Employee_Firstname` - Employee's first name
- `Global.ESS_UserContext_Employee_Lastname` - Employee's last name

### Workday API
- **Service**: Human_Resources
- **Version**: v42.0
- **Operations**:
  - `Get_Change_Home_Contact_Information` - For home/personal contact data
  - `Get_Workers` (Work Contact) - For work contact data
  - `Get_Workers` (Work Address) - For work address

## Workflow

```
┌─────────────────────────────────────┐
│   User triggers topic               │
│   (e.g., "What is my work phone?")  │
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
│   Fetch Work Contact Information    │
│   (msdyn_HRWorkdayHCMEmployee       │
│    GetWorkContactInformation)       │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Parse Work Contact Data           │
│   (Phones, Emails)                  │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Fetch Home Contact Information    │
│   (msdyn_HRWorkdayHCMEmployee       │
│    GetHomeContactInformation)       │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Parse Home Contact Data           │
│   (Phones, Emails, Address)         │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Fetch Work Address                │
│   (msdyn_HRWorkdayHCMEmployee       │
│    GetWorkAddress)                  │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Combine All Contact Data          │
│   and return to AI for response     │
└─────────────────────────────────────┘
```

## Trigger Phrases

### Work Contact
- "Show my contact details"
- "What is my work phone?"
- "What is my work email?"
- "What is my work address?"
- "Show my work contact information"

### Home/Personal Contact
- "Show my personal phone number"
- "What is my home phone number?"
- "Show my home email"
- "Can you tell me what my personal email is?"
- "Which personal email is registered as primary?"
- "Show my home address"
- "Show my personal contact information"

## Data Retrieved

### Work Contact Data

| Field | Description |
|-------|-------------|
| workPhoneNumbers | Table of work phone numbers with primary indicator |
| workEmails | Table of work email addresses with primary indicator |
| workAddress | Formatted work address |

### Home Contact Data

| Field | Description |
|-------|-------------|
| homePhoneNumbers | Table of personal phone numbers with primary indicator |
| homeEmails | Table of personal email addresses with primary indicator |
| homeAddress | Formatted home address |

### Phone Number Structure

| Property | Type | Description |
|----------|------|-------------|
| PhoneNumber | String | Formatted phone number |
| IsPrimaryPhoneNumber | Boolean | Whether this is the primary phone |

### Email Structure

| Property | Type | Description |
|----------|------|-------------|
| EmailAddress | String | Email address |
| IsPrimaryEmailAddress | String | Whether this is the primary email |

## XML Template Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `{Employee_ID}` | Employee's Workday ID | `21514` |
| `{As_Of_Effective_Date}` | Current date (YYYY-MM-DD) | `2026-01-28` |

## Response Properties Extracted

### Home Contact Information

| Key | XPath | Description |
|-----|-------|-------------|
| PhoneInformation | `//*[local-name()='Phone_Information_Data']` | All phone data nodes |
| EmailInformation | `//*[local-name()='Email_Information_Data']` | All email data nodes |
| HomeAddress | `//@*[local-name()='Formatted_Address']` | Formatted address string |

## Example Interactions

### Example 1: Work Phone Query
**User**: "What is my work phone?"

**Agent**: "Your work phone number is **(555) 123-4567** (Primary)."

---

### Example 2: Personal Email Query
**User**: "What is my personal email?"

**Agent**: "Your personal email addresses are:
- **john.smith@gmail.com** (Primary)
- john.backup@outlook.com"

---

### Example 3: Full Contact Info
**User**: "Show my contact information"

**Agent**: "Here's your contact information:

**Work Contact:**
- Phone: (555) 123-4567 ⭐
- Email: john.smith@company.com ⭐
- Address: 123 Business Ave, Suite 100, Seattle, WA 98101

**Personal Contact:**
- Phone: (555) 987-6543 ⭐
- Email: john.smith@gmail.com ⭐
- Address: 456 Home Street, Apt 2B, Seattle, WA 98102"

---

### Example 4: Home Address Query
**User**: "What is my home address?"

**Agent**: "Your home address is **456 Home Street, Apt 2B, Seattle, WA 98102**."

## Setup Instructions

1. **Import the Topic**: Import `topic.yaml` into your Copilot Studio agent
2. **Add XML Templates**: Upload the following to your Workday connector configuration:
   - `msdyn_HRWorkdayHCMEmployeeGetHomeContactInformation.xml`
   - Work contact and work address templates (if not already present)
3. **Configure Connection**: Ensure your Workday connector connection reference is properly set in the topic
4. **Set Global Variables**: Make sure the following are populated from user authentication:
   - `Global.ESS_UserContext_Employee_Id`
   - `Global.ESS_UserContext_Employee_Firstname`
   - `Global.ESS_UserContext_Employee_Lastname`

## Dependencies

- `msdyn_copilotforemployeeselfservicehr.topic.WorkdaySystemAccessCheck` - Verifies user access permissions
- `msdyn_copilotforemployeeselfservicehr.topic.WorkdaySystemGetCommonExecution` - Common API execution topic
- `msdyn_HRWorkdayHCMEmployeeGetWorkContactInformation` - Scenario for work contact data
- `msdyn_HRWorkdayHCMEmployeeGetHomeContactInformation` - Scenario for home contact data
- `msdyn_HRWorkdayHCMEmployeeGetWorkAddress` - Scenario for work address
- `Global.ESS_UserContext_Employee_Id` - Current user's employee ID

## Model Instructions

The topic includes model instructions to:
- Respond based on the specific contact information the user is asking for
- Only respond to requests about the user's own contact information
- Treat "Home" and "Personal" as synonymous terms

### Invalid Requests (Rejected)
- "What is my manager's contact information?"
- "What is my sister's contact information?"
- "Show [EmployeeName]'s phone number"

### Valid Requests (Accepted)
- "What is my contact information?"
- "What is my work phone?"
- "Show my home email"
- "What is my personal address?"

## Output Type

The topic outputs a `finalizedContactInformation` record:

```yaml
finalizedContactInformation:
  employeeName: String        # e.g., "John Smith"
  workPhoneNumbers:           # Table
    - PhoneNumber: String     # e.g., "(555) 123-4567"
      IsPrimaryPhoneNumber: Boolean
  workEmails:                 # Table
    - EmailAddress: String    # e.g., "john@company.com"
      IsPrimaryEmailAddress: String
  workAddress: String         # Formatted work address
  homePhoneNumbers:           # Table
    - PhoneNumber: String
      IsPrimaryPhoneNumber: Boolean
  homeEmails:                 # Table
    - EmailAddress: String
      IsPrimaryEmailAddress: String
  homeAddress: String         # Formatted home address
```
