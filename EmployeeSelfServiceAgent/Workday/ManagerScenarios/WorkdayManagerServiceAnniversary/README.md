---
nav_exclude: true
search_exclude: false
---
# Workday Get Manager Reportees Service Anniversaries
## Overview
For each of their supervisory organizations, this scenario enables managers to view their direct reports along with Service Anniversary details.

## Files

| File | Description |
|------|-------------|
| `topic.yaml` | Copilot Studio topic definition with trigger phrases and Power Fx logic |
| `msdyn_HRWorkdayHCMManagerServiceAnniversary.xml` | XML template for Workday Get_Workers API call |

## Prerequisites

### Global Variables Required
- Check the `ManagerScenarios` folder for more details on prerequisites.
    - `msdyn_HRWorkdayHCMEmployeeGetData` - A SOAP template for retrieving the Workday supervisory organization IDs for a manager
    - `Global.Manager_Supervisory_OrgIds` - A list of all of the Workday supervisory organization IDs of a manager

### Workday API
- **Service**: Human_Resources
- **Operation**: Get_Workers
- **Version**: v41.0

## Scenario Details

### What It Does
1. Retrieves all employees in all supervisory organizations for the manager (all direct reports).
2. Extracts key employee information (Job Title, Business Title, etc.)
3. Presents results in a formatted table

### Trigger Phrases
- When are the service anniversaries of all my directs?
- What are the service anniversaries of my entire team?
- Show me the service anniversaries of my reports?

## Response Group Configuration

The XML template is optimized for performance by:
- **Including**: Reference, Personal Information, Employment Information
- **Excluding**: Compensation, Benefits, Documents, Photos, and other unnecessary data

## Setup Instructions

1. **Import the Topic**: Import `topic.yaml` into your Copilot Studio agent
2. **Add XML Template**: Upload `msdyn_HRWorkdayHCMManagerServiceAnniversary.xml` to your Workday connector configuration
3. **Configure Connection**: Ensure your Workday connector connection reference is properly set in the topic
4. **Set Global Variable**: Make sure `Global.Manager_Supervisory_OrgIds` is populated (typically from user context setup)

## Example Output

When a manager asks "Show me my team's service anniversaries", the agent displays:

> Here’s a summary of your team’s upcoming service anniversaries:
> 
> | Employee Name | Hire Date    | Upcoming Service Anniversary | Upcoming Milestone |
> | ------------- | ------------- | ------------- | ------------- |
> | John Doe      | 	2025-07-01	|2026-07-01 |	1 year          |
> | Jane Doe      |	2025-08-25	|2026-08-25	|   1 year          |
> | John Smith    |	2025-08-01	| 2026-08-01 |  1 year          |

