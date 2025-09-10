# ESS Workday Scenarios

This folder contains sample topic definitions and WorkSOAP Request XML that customers can use to extend the functionality of their ESS Workday Agent setup. Use the topic definitions (`topic-definition.yaml`) and the accompanying WorkSOAP Request XML files to create new topics in your environment or to customize the behavior of existing topics for the scenarios listed below.

Usage notes:
- Each scenario folder contains a `topic-definition.yaml` (the Copilot/ESS topic) and a WorkSOAP Request XML (Workday request) used by the topic. 
- Copy or adapt the `topic-definition.yaml` into your Copilot / ESS topic catalog and ensure the WorkSOAP XML is available to your Workday connector or integration.
- Update parameter bindings (for example employee id, manager org id, effective date) to match your runtime context.
- The topic `.yaml` files include trigger queries (sample prompts). Use those as seeds for testing.

Below is a consolidated table that lists each scenario, a short description, and sample prompt(s) you can use to test the topic.

| Scenario | Description | Sample prompt(s) |
|---|---|---|
| `WorkdayEmployeesviewtheirjobtaxonomy` | Responds to requests about the requesting user's job taxonomy (job title, job function, job profile). | "What is my job title?"<br>"What is my external title?" |
| `WorkdayGetContactInformation` | Returns the requesting user's contact information (work/home phones, emails, addresses). | "What is my Work Phone?"<br>"Show my Home Email" |
| `WorkdayGetEducation` | Returns the requesting user's education history (school, degree, field of study, years attended). | "Show my Education Details"<br>"What was my field of study?" |
| `WorkdayGetGovernmentIDs` | Returns government ID information associated with the requesting user's profile (ID types, issued/expiration dates, country). | "What are my Government Ids?" |
| `WorkdayManagersdirect-CompanyCode` | Returns company code and company name for employees who directly report to the requesting user (manager view). Output is produced as a nested markdown list. | "What are the company codes for my reports?" |
| `WorkdayManagersdirect-CostCenter` | Returns cost center details for direct reports of the requesting user. Output is produced as a nested markdown list. | "What is the cost center of my direct reports?" |
| `WorkdayManagersdirect-Jobtaxanomy` | Returns job taxonomy (job title, business title, job profile, job family) for the manager's direct reports. Output is produced as a nested markdown list. | "Show me my team's job title"<br>"What is the job title of [EmployeeName]?" |
| `WorkdayManagerServiceAnniversary` | Returns upcoming service anniversaries for a manager's direct reports. The topic returns a markdown table with Employee Name, Hire Date, Upcoming Service Anniversary Date, Upcoming Milestone. | "When are the service anniversaries of all my directs?"<br>"What is [EmployeeName]'s next service anniversary?" |