---
nav_exclude: true
search_exclude: false
---
# Workday Get Manager Reportees Job Taxonomy

## Overview
For each of their supervisory organizations, this scenario enables managers to view their direct reports along with Position details.

## Files

| File | Description |
|------|-------------|
| `topic.yaml` | Copilot Studio topic definition with trigger phrases and Power Fx logic |
| `msdyn_HRWorkdayHCMManagerJobTaxonomy.xml` | XML template for Workday Get_Workers API call |

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
2. Extracts key employee information (Job Title, Business Title, etc.)
3. Presents results in a formatted table

### Trigger Phrases
- Show me my team's job title?
- What is the internal title of my direct report X?
- What is the job function of my team?
- What job profile is mapped to my team members?

## Response Group Configuration

The XML template is optimized for performance by:
- **Including**: Reference, Personal Information, Employment Information
- **Excluding**: Compensation, Benefits, Documents, Photos, and other unnecessary data

## Setup Instructions

1. **Import the Topic**: Import `topic.yaml` into your Copilot Studio agent
2. **Add XML Template**: Upload `msdyn_HRWorkdayHCMManagerJobTaxonomy.xml` to your Workday connector configuration
3. **Configure Connection**: Ensure your Workday connector connection reference is properly set in the topic
4. **Set Global Variable**: Make sure `Global.Manager_Supervisory_OrgIds` is populated (typically from user context setup)

## Example Output

When a manager asks "Show me my team's job taxonomy", the agent displays:


> # Team job taxonomy
> Here’s an overview of your team’s job taxonomy:
>
> * John Smith
>   * Job Title: Sales Solution Consultant
>   * Job Family: Sales-Sales & Support
>   * Job Profile: Sales Solution Consultant
> * Jane Doe
>   * Job Title: Sales Solution Consultant
>   * Job Family: Special & Characters
>   * Job Profile: Sales Solution Consultant
> * Jane Smith
>   * Job Title: Sales Solution Consultant
>   * Job Family: Sales-Sales & Support
>   * Job Profile: Sales Solution Consultant
>
> If you need more details or want to see taxonomy for a specific team member, let me know!

