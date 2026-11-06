---
nav_exclude: true
search_exclude: false
---

# Workday Employee View Job Information

This topic lets employees view their current Workday job information from a
Copilot Studio agent.

When an employee triggers this topic, the agent:

1. Retrieves the employee's position title, business title, job profile, and
   job-family ID from Workday
2. Uses the configured job-family descriptor when one is available
3. Returns the assembled job information to the employee

**Example trigger phrases:** "What is my job title?" · "What is my job profile?"
· "What job family do I belong to?" · "Tell me about my role"

This topic is limited to the signed-in employee's own job information. Requests
for another person's job information are outside its scope.

Workday job families are optional groupings of related job profiles. See
Workday's [Job Profiles][workday-job-profiles] documentation for an explanation
of job profiles, job families, and job family groups.

## Prerequisites

Before you start, make sure you have:

- The applicable ESS HR managed solution installed in your agent
- A Workday connector configured with **User**-level authentication
- `Global.ESS_UserContext_Employee_Id` populated with the signed-in employee's
  Workday Employee ID
- `Global.ESS_UserContext_Employee_Firstname` and
  `Global.ESS_UserContext_Employee_Lastname` populated
- The `msdyn_HRWorkdayHCMEmployeeGetJobTaxonomy` template imported
- The Dataverse-backed Workday reference-data components included in these
  solution baselines:

| Surface           | Solution               | Minimum version |
| ----------------- | ---------------------- | --------------- |
| Classic           | `msdyn_EssHRWorkday`   | `1.1.0.5`       |
| Declarative Agent | `msdyn_EssDAHRWorkday` | `1.1.0.2`       |

## What's in this folder

- `topic.yaml`: conversation flow and job-information response mapping
- `msdyn_HRWorkdayHCMEmployeeGetJobTaxonomy.xml`: Workday `Get_Workers` request
  and response mapping
- `README.md`: setup and configuration guidance

The corresponding Workday DA scenario contains the Declarative Agent variant
with the same Workday data contract.

## Import the template

Add `msdyn_HRWorkdayHCMEmployeeGetJobTaxonomy.xml` to your agent's ESS Template
Configuration before importing and testing the topic.

The template makes a requester-scoped Workday `Get_Workers` request and
extracts:

- `Position_Title`
- `Business_Title`
- `Job_Profile_Name`
- `Job_Family_ID`

## Configure job-family display names

`msdyn_HRWorkdayHCMReferenceData_Job_Family_ID` contains an ESS-specific seed
set of job-family ID-to-descriptor mappings. These entries provide friendly
display names and are not a Workday-defined canonical list.

You can replace or extend the seed entries with values from your Workday tenant:

- `ID` is the tenant's Workday `Job_Family_ID`
- `Referenced_Object_Descriptor` is the friendly name shown to the employee

When a matching entry exists, the topic displays its descriptor. When no entry
exists, the topic displays the raw `Job_Family_ID`. This mapping affects only
the displayed job-family value; the employee's title, business title, and job
profile come directly from Workday.

## Import and test the topic

1. In Copilot Studio, go to **Topics > + Add a topic > From file**.
2. Select `topic.yaml` and import it.
3. Open **Test your agent** and try these cases:

- Ask "Tell me about my role." The response includes the employee's name, title,
  business title, job profile, and job family.
- Test with a mapped `Job_Family_ID`. The friendly configured descriptor
  appears.
- Test with an unmapped `Job_Family_ID`. The raw Workday ID appears and the
  other job details remain available.
- Test an employee without a job-family assignment. The job-family value is
  blank and the other job details remain available.

## Dependencies

This topic uses:

- **Workday `Get_Workers`** — `Human_Resources` service with User-level
  authentication
- **`WorkdaySystemGetCommonExecution`** — executes the Workday request template
- **`WorkdaySystemRefreshReferenceData`** — loads the optional job-family
  display mappings from Dataverse
- **`msdyn_HRWorkdayHCMReferenceData_Job_Family_ID`** — stores the
  ID-to-descriptor mappings

The job-family reference-data lookup does not make a second Workday request.

## Troubleshooting

### The job family shows a raw ID

No descriptor is configured for that `Job_Family_ID`. Add a mapping to
`msdyn_HRWorkdayHCMReferenceData_Job_Family_ID` if you want to show a friendly
name.

### The job family is blank

Workday may not associate the employee's job profile with a job family.
Job-family assignment is optional and does not prevent the other job details
from being returned.

### No job information is returned

Confirm that `Global.ESS_UserContext_Employee_Id` is populated, the Workday
connector is configured, and the request template has been imported.

[workday-job-profiles]:
  https://stage.doc.workday.com/workday-education/en-us/course-manuals/hcm-core-for-administrators/job-profiles.html
