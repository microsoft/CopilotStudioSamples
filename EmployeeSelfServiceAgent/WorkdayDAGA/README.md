---
title: Workday
parent: Employee Self-Service
nav_order: 1
---
# ESS Workday Scenarios

Sample Copilot Studio topics and the Workday request templates they call. Copy them into your agent to add a scenario, or to customise how an existing one behaves.

## How to use a sample

Each folder holds a `topic.yaml` and a `template-config-partial.yaml` carrying every Workday request template that topic calls.

1. Paste `topic.yaml` into a new topic in your agent.
2. In the **Workday [System] - 1: Set Runtime Template Configurations** topic, paste the partial's `SetVariable` actions under `beginDialog` > `actions`.
3. In that same topic, add the `{ Key: ..., Value: ... }` rows from the end of the partial to the `Global.ESS_WorkdayHCM_Template_Configurations` action.

{: .warning }
> Step 3 is the easy one to miss. The runtime resolves a template with `LookUp(Global.ESS_WorkdayHCM_Template_Configurations, Key=Topic.scenarioName, Value)`, so a template that is set but never registered returns blank rather than erroring.

Then before testing:

- If your agent already registers a scenario of the same name, replace that entry rather than adding a second — a duplicate `Key` shadows the first.
- Update parameter bindings (employee id, manager org id, effective date) to match your runtime context.
- Use the trigger phrases in each `topic.yaml` as test seeds.

## Scenarios

| Scenario | Description | Sample prompt(s) |
|---|---|---|
| `EmployeeAddDependents` | Lets employees add a new dependent (spouse, partner, child, parent) to their own Workday profile and benefits. | "Add a dependent"<br>"Add my spouse to my benefits"<br>"I had a baby — add them as a dependent" |
| `EmployeeGetVacationBalance` | Returns the requesting user's vacation balance information from Workday. Displays available time off that can be taken. | "What is my vacation balance?"<br>"How much time off can I take?"<br>"What is my workday vacation balance?" |
| `EmployeeUpdateResidentialAddress` | Lets employees view and update their own residential/home address in Workday. | "Update my home address"<br>"I moved — fix my address"<br>"Change my street and zip code" |
| `WorkdayEmployeeRequestTimeOff` | Allows employees to submit time off requests for themselves through Workday. Prompts for necessary details like dates and hours. | "Request 8 hours vacation on 2025-09-15"<br>"I want to request time off"<br>"Submit vacation request" |
| `WorkdayEmployeesviewtheirjobtaxonomy` | Responds to requests about the requesting user's job taxonomy (job title, job function, job profile). | "What is my job title?"<br>"What is my external title?" |
| `WorkdayGetContactInformation` | Returns the requesting user's contact information (work/home phones, emails, addresses). | "What is my Work Phone?"<br>"Show my Home Email" |
| `WorkdayGetEducation` | Returns the requesting user's education history (school, degree, field of study, years attended). | "Show my Education Details"<br>"What was my field of study?" |
| `WorkdayGetGovernmentIDs` | Returns government ID information associated with the requesting user's profile (ID types, issued/expiration dates, country). | "What are my Government Ids?" |
| `WorkdayGetUserProfile` | Returns the requesting user's personal profile from Workday: identity, contact, and organization information. | "Show my employee profile"<br>"What's my employee ID?"<br>"Who is my manager?" |
| `WorkdayGivePeerFeedback` | Lets employees send feedback about a coworker through Workday. | "Give feedback"<br>"Share feedback for a colleague"<br>"Submit peer feedback" |
| `WorkdayManageEmergencyContact` | Lets employees view, add, update, or remove their own emergency contacts in Workday. | "Manage my emergency contacts"<br>"Update my emergency contact"<br>"Who is my emergency contact?" |
| `WorkdayGetManagerReporteesTimeInPosition` | Returns how long each of the requesting manager's direct reports has been in their current position. | "How long has my team been in their roles?"<br>"What is [EmployeeName]'s time in position?" |
| `WorkdayManagersdirect-CompanyCode` | Returns company code and company name for employees who directly report to the requesting user (manager view). Output is produced as a nested markdown list. | "What are the company codes for my reports?" |
| `WorkdayManagersdirect-CostCenter` | Returns cost center details for direct reports of the requesting user. Output is produced as a nested markdown list. | "What is the cost center of my direct reports?" |
| `WorkdayManagersdirect-Jobtaxanomy` | Returns job taxonomy (job title, business title, job profile, job family) for the manager's direct reports. Output is produced as a nested markdown list. | "Show me my team's job title"<br>"What is the job title of [EmployeeName]?" |
| `WorkdayManagerServiceAnniversary` | Returns upcoming service anniversaries for a manager's direct reports. The topic returns a markdown table with Employee Name, Hire Date, Upcoming Service Anniversary Date, Upcoming Milestone. | "When are the service anniversaries of all my directs?"<br>"What is [EmployeeName]'s next service anniversary?" |