---
nav_exclude: true
search_exclude: false
---
# Workday Get Manager Reportees Time In Position

## Overview
This scenario enables managers to view their direct reports along with how long each employee has been in their current position. For each supervisory organization, it retrieves team member information from Workday HCM and calculates the time in position for each reportee. The columns displayed can be altered by updating the topic's Model Description section.

## Files

| File | Description |
|------|-------------|
| `topic.yaml` | Copilot Studio topic definition with trigger phrases and Power Fx logic |
| `msdyn_GetManagerReportees.xml` | XML template for Workday Get_Workers API call |

## Prerequisites

### Global Variables Required
- Check the `ManagerScenarios` folder for more details on prerequisites.
    - `msdyn_HRWorkdayHCMEmployeeGetData` - A SOAP template for retrieving the Workday supervisory organization IDs for a manager
    - `Global.Manager_Supervisory_OrgIds` - A list of all of the Workday supervisory organization IDs of a manager

### Workday API
- **Service**: Human_Resources
- **Operation**: Get_Workers
- **Version**: v42.0

## Scenario Details

### What It Does
1. Retrieves all employees in the manager's organization (direct reports)
2. Extracts key employee information (Name, Title, Position Start Date, etc.)
3. Calculates Time in Position for each employee using Power Fx DateDiff functions
4. Presents results with tenure information formatted as "X years, Y months, Z days"

### Data Retrieved
| Field | Description |
|-------|-------------|
| EmployeeID | Workday Employee ID |
| Name | Employee's legal formatted name |
| BusinessTitle | Current job title |
| WorkerType | Employee or Contingent Worker |
| JobProfile | Job profile name |
| Location | Business site/location name |
| PositionStartDate | Date employee started current position |
| HireDate | Original hire date |
| Status | Active/Inactive status |
| TimeInPositionYears | Calculated years in current position |
| TimeInPositionMonths | Calculated remaining months |
| TimeInPositionDays | Calculated remaining days |
| TimeInPosition | Formatted string (e.g., "2 years, 3 months, 15 days") |

### Trigger Phrases
- "Show me my team's time in position"
- "How long have my direct reports been in their roles"
- "Get reportees time in current position"
- "List my team members with their position tenure"
- "Who on my team has been in their role the longest"
- "Show tenure for my direct reports"
- "My reportees job tenure"
- "Time in position for my team"

## Time In Position Calculation

The scenario uses Power Fx formulas to calculate time in position:

```
TimeInPositionYears = Int(DateDiff(DateValue(PositionStartDate), Now(), TimeUnit.Months) / 12)
TimeInPositionMonths = Mod(DateDiff(DateValue(PositionStartDate), Now(), TimeUnit.Months), 12)
TimeInPositionDays = DateDiff(DateAdd(DateAdd(DateValue(PositionStartDate), Years, TimeUnit.Years), Months, TimeUnit.Months), Now(), TimeUnit.Days)
```

## Response Group Configuration

The XML template is optimized for performance by:
- **Including**: Reference, Personal Information, Employment Information
- **Excluding**: Compensation, Benefits, Documents, Photos, and other unnecessary data
- **Filtering**: Only active workers (`Exclude_Inactive_Workers: true`)

## Setup Instructions

1. **Import the Topic**: Import `topic.yaml` into your Copilot Studio agent
2. **Add XML Template**: Upload `msdyn_GetManagerReportees.xml` to your Workday connector configuration
3. **Configure Connection**: Ensure your Workday connector connection reference is properly set in the topic
4. **Set Global Variable**: Make sure `Global.Manager_Supervisory_OrgIds` is populated (typically from user context setup)

## Model Instructions

The topic includes model instructions for the AI to:
- Display results as a nested markdown list
- Format Time in Position clearly
- Show Name, Job Title, Time in Position and Status for each reportee
- Sort or group results based on user's question context

## Example Output

When a manager asks "Show me my team's time in position", the agent displays:

# Team roles and time in position
Here's a list of your team members and how long they've been in their positions. I pulled this from Workday, an HR platform your company uses.

> | Name | Title   | Time in Position | Status |
> | ------------- | ------------- | ------------- | ------------- |
> | Jane Doe	| Sales Solution Consultant |	8 months 28 days |	Active
> | John Smith	| Sales Solution Consultant |	7 months 5 days |	Active
> | Jack Doe	| Sales Solution Consultant	| 7 months 28 days |	Active
>
> If you need more details about a specific team member’s role or tenure, just let me know!