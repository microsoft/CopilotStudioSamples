---
nav_exclude: true
search_exclude: false
---
# Workday Get Manager Reportees Company Codes

## Overview
This scenario enables managers to view their direct reports along with Company Code or Company Name details for each of their supervisory organizations.

## Files

| File | Description |
|------|-------------|
| `topic.yaml` | Copilot Studio topic definition with trigger phrases and Power Fx logic |
| `msdyn_HRWorkdayHCMManagerDirectCompanyCode.xml` | XML template for Workday Get_Workers API call |

## Prerequisites

### Global Variables Required
- `Global.Manager_Supervisory_OrgIds` - A list of all of the Workday supervisory organization IDs of a manager (used to filter direct reports)

### Workday API
- **Service**: Human_Resources
- **Operation**: Get_Workers
- **Version**: v41.0

## Scenario Details

### What It Does
1. Retrieves all employees in all supervisory organizations for the manager (all direct reports).
2. Extracts key employee information (Name, Company Code, Company Name, etc.)
3. Presents results in a formatted table

### Trigger Phrases
- What is the company code of my direct reports?
- Show my team's company code
- What are the company codes for my reports? 
- What company codes are mapped to my team members?

## Response Group Configuration

The XML template is optimized for performance by:
- **Including**: Reference, Personal Information, Employment Information
- **Excluding**: Compensation, Benefits, Documents, Photos, and other unnecessary data

## Setup Instructions

1. **Import the Topic**: Import `topic.yaml` into your Copilot Studio agent
2. **Add XML Template**: Upload `msdyn_HRWorkdayHCMManagerDirectCompanyCode.xml` to your Workday connector configuration
3. **Configure Connection**: Ensure your Workday connector connection reference is properly set in the topic
4. **Set Global Variable**: Make sure `Global.Manager_Supervisory_OrgIds` is populated (typically from user context setup)

## Example Output

When a manager asks "Show me my team's company codes", the agent displays:

> # Team company codes
> Here’s the company code information for your team:
> 
> * John Smith: Company code is GMS USA (Global Modern Services, Inc. (USA))
> * John Doe: Company code is GMS USA (Global Modern Services, Inc. (USA))
> * Jane Smith: Company code is GMS USA (Global Modern Services, Inc. (USA))
> 
> If you need more details or want to see company codes for other teams, just let me know!