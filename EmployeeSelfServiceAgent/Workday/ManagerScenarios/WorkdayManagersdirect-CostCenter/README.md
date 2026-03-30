---
nav_exclude: true
search_exclude: false
---
# Workday Get Manager Reportees Cost Center

## Overview
for each of their supervisory organizations, this scenario enables managers to view their direct reports along with Cost Centers.

## Files

| File | Description |
|------|-------------|
| `topic.yaml` | Copilot Studio topic definition with trigger phrases and Power Fx logic |
| `msdyn_HRWorkdayHCMManagerDirectCostCenter.xml` | XML template for Workday Get_Workers API call |

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
2. Extracts key employee information (Cost Center, Cost Center Name, etc.)
3. Presents results in a formatted table

### Trigger Phrases
- Show me my team’s cost center data? 
- What cost centers are assigned to my reports? 
- What are my team’s cost centers?

## Response Group Configuration

The XML template is optimized for performance by:
- **Including**: Reference, Personal Information, Employment Information
- **Excluding**: Compensation, Benefits, Documents, Photos, and other unnecessary data

## Setup Instructions

1. **Import the Topic**: Import `topic.yaml` into your Copilot Studio agent
2. **Add XML Template**: Upload `msdyn_HRWorkdayHCMManagerDirectCostCenter.xml.xml` to your Workday connector configuration
3. **Configure Connection**: Ensure your Workday connector connection reference is properly set in the topic
4. **Set Global Variable**: Make sure `Global.Manager_Supervisory_OrgIds` is populated (typically from user context setup)

## Example Output

When a manager asks "Show me my team's cost center", the agent displays:

> # Team cost centers
> Here’s the available information for your team’s cost centers:
> 
> * John Smith: Cost center information is not available.
> * Jane Doe
>    * Cost Center Code: CC-1
>    * Cost Center Name: Cost Center 1
> * Jane Smith
>    * Cost Center Code: CC-1
>    * Cost Center Name: Cost Center 1
>
> If you need further details or want to check for updates, let me know!
